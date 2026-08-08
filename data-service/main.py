"""
main.py

Prodrome data service: a thin, read-only FastAPI layer over prodrome.db.

This service ONLY serves data -- it does not call any LLM and does not
know anything about agents, committees, or verdicts. That separation
matters: it keeps the data layer trivially testable with curl, and it
means the orchestration layer (n8n during dev, or the FastAPI agent
backend when deployed) can point its Tool nodes at these endpoints
without caring how the data is stored.

Run:
    uvicorn main:app --reload --port 8001

Test:
    curl http://localhost:8001/patients
    curl http://localhost:8001/patients/p000001/vitals?hours_back=6
"""

import sqlite3
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from data_loader import DB_PATH

app = FastAPI(title="Prodrome Data Service", version="0.1.0")

# Wide-open CORS for local dev. Tighten this (specific origin) once the
# frontend has a real deployed URL.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def _get_conn():
    if not Path(DB_PATH).exists():
        raise HTTPException(
            status_code=503,
            detail="prodrome.db not found. Run `python data_loader.py --data-dir sample_data` first.",
        )
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def _patient_exists(conn, patient_id: str) -> bool:
    row = conn.execute(
        "SELECT 1 FROM hourly_records WHERE patient_id = ? LIMIT 1", (patient_id,)
    ).fetchone()
    return row is not None


@app.get("/health")
def health():
    return {"status": "ok", "db_exists": Path(DB_PATH).exists()}


@app.get("/patients")
def list_patients(limit: int = 50):
    """
    Lists patients with a quick summary -- max ICU hour reached and
    whether they were ever labeled septic. Used by the frontend to
    populate a demo patient picker, and by the Historical Pattern
    agent's cohort queries.
    """
    conn = _get_conn()
    rows = conn.execute("""
        SELECT patient_id,
               MAX(icu_hour) AS max_hour,
               MAX(sepsis_label) AS ever_septic,
               MIN(age) AS age,
               MIN(gender) AS gender
        FROM hourly_records
        GROUP BY patient_id
        ORDER BY patient_id
        LIMIT ?
    """, (limit,)).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def _flag_hr(hr):
    if hr is None:
        return "unknown"
    if hr < 60:
        return "bradycardia"
    if hr > 100:
        return "tachycardia"
    return "normal"


def _flag_map(map_val):
    if map_val is None:
        return "unknown"
    if map_val < 65:
        return "low_perfusion_concern"
    return "normal"


def _flag_sbp(sbp):
    if sbp is None:
        return "unknown"
    if sbp < 90:
        return "hypotension"
    if sbp > 180:
        return "hypertension_concern"
    return "normal"


def _flag_resp(resp):
    if resp is None:
        return "unknown"
    if resp < 12:
        return "bradypnea"
    if resp > 24:
        return "tachypnea"
    return "normal"


def _flag_temp(temp):
    if temp is None:
        return "unknown"
    if temp < 36:
        return "hypothermia"
    if temp > 38.3:
        return "fever"
    return "normal"


def _vitals_flags(row: dict) -> dict:
    return {
        "hr_status": _flag_hr(row.get("hr")),
        "map_status": _flag_map(row.get("map")),
        "sbp_status": _flag_sbp(row.get("sbp")),
        "resp_status": _flag_resp(row.get("resp")),
        "temp_status": _flag_temp(row.get("temp")),
    }


def _is_abnormal_vital_flag(status: str) -> bool:
    return status not in ("normal", "unknown")


def compute_vitals_verdict(window: list[dict]) -> str:
    """Classify a vitals window as STABLE/WATCH/DETERIORATING/CRITICAL."""
    n = len(window)
    if n == 0:
        return "STABLE"
    half = n / 2.0
    flag_keys = ["hr_status", "map_status", "sbp_status", "resp_status", "temp_status"]
    other_keys = ["hr_status", "map_status", "resp_status", "temp_status"]

    def _count_abnormal(key: str) -> int:
        return sum(
            1 for hour in window
            if _is_abnormal_vital_flag(hour.get("flags", {}).get(key, "unknown"))
        )

    sbp_hypotension_hours = sum(
        1 for hour in window
        if hour.get("flags", {}).get("sbp_status") == "hypotension"
    )
    others_over_half = sum(1 for key in other_keys if _count_abnormal(key) > half)
    if sbp_hypotension_hours > half and others_over_half >= 2:
        return "CRITICAL"

    simultaneous_3plus = sum(
        1 for hour in window
        if sum(
            1 for key in flag_keys
            if _is_abnormal_vital_flag(hour.get("flags", {}).get(key, "unknown"))
        ) >= 3
    )
    if simultaneous_3plus > half:
        return "DETERIORATING"

    any_abnormal = any(
        _is_abnormal_vital_flag(status)
        for hour in window
        for status in hour.get("flags", {}).values()
    )
    if any_abnormal:
        return "WATCH"

    return "STABLE"


@app.get("/patients/{patient_id}/vitals")
def get_vitals_window(patient_id: str, hours_back: int = Query(6, ge=1, le=200),
                       up_to_hour: Optional[int] = None):
    """
    Tool endpoint for the Vitals Agent.
    Returns HR, O2Sat, Temp, SBP, MAP, DBP, Resp, EtCO2 for the trailing
    `hours_back` window, ending at `up_to_hour` (defaults to the
    patient's latest recorded hour -- used for replay-at-a-point-in-time).
    Also returns deterministic normal/abnormal flags per vital so the
    agent does not have to compare numbers against thresholds itself.
    """
    conn = _get_conn()
    if not _patient_exists(conn, patient_id):
        conn.close()
        raise HTTPException(404, f"Unknown patient_id: {patient_id}")

    if up_to_hour is None:
        up_to_hour = conn.execute(
            "SELECT MAX(icu_hour) FROM hourly_records WHERE patient_id = ?",
            (patient_id,),
        ).fetchone()[0]

    rows = conn.execute("""
        SELECT icu_hour, hr, o2sat, temp, sbp, map, dbp, resp, etco2
        FROM hourly_records
        WHERE patient_id = ? AND icu_hour <= ? AND icu_hour > ?
        ORDER BY icu_hour
    """, (patient_id, up_to_hour, up_to_hour - hours_back)).fetchall()
    conn.close()

    window = []
    any_abnormal = False
    for r in rows:
        hour = dict(r)
        flags = _vitals_flags(hour)
        hour["flags"] = flags
        if any(v not in ("normal", "unknown") for v in flags.values()):
            any_abnormal = True
        window.append(hour)

    return {
        "patient_id": patient_id,
        "up_to_hour": up_to_hour,
        "window": window,
        "any_abnormal_in_window": any_abnormal,
        "computed_verdict": compute_vitals_verdict(window),
    }


def _flag_lactate(lactate):
    if lactate is None:
        return "not_drawn"
    if lactate > 4.0:
        return "critical"
    if lactate > 2.0:
        return "elevated"
    return "normal"


def _flag_wbc(wbc):
    if wbc is None:
        return "not_drawn"
    if wbc < 4.0:
        return "leukopenia"
    if wbc > 12.0:
        return "leukocytosis"
    return "normal"


def _flag_creatinine(creatinine):
    if creatinine is None:
        return "not_drawn"
    if creatinine > 1.2:
        return "elevated"
    return "normal"


def _flag_platelets(platelets):
    if platelets is None:
        return "not_drawn"
    if platelets < 150:
        return "thrombocytopenia"
    return "normal"


def _flag_bun(bun):
    if bun is None:
        return "not_drawn"
    if bun > 20:
        return "elevated"
    return "normal"


def _labs_flags(row: dict) -> dict:
    return {
        "lactate_status": _flag_lactate(row.get("lactate")),
        "wbc_status": _flag_wbc(row.get("wbc")),
        "creatinine_status": _flag_creatinine(row.get("creatinine")),
        "platelets_status": _flag_platelets(row.get("platelets")),
        "bun_status": _flag_bun(row.get("bun")),
    }


def _is_abnormal_lab_flag(status: str) -> bool:
    return status not in ("normal", "not_drawn")


def _hour_had_any_lab(hour: dict) -> bool:
    return any(v is not None for k, v in hour.items() if k not in ("icu_hour", "flags"))


def compute_labs_verdict(window: list[dict], labs_drawn_count: int) -> str:
    """Classify a labs window as STABLE/WATCH/DETERIORATING/CRITICAL."""
    if labs_drawn_count == 0:
        return "STABLE"

    drawn = [hour for hour in window if _hour_had_any_lab(hour)]
    half = labs_drawn_count / 2.0
    lab_keys = [
        "lactate_status", "wbc_status", "creatinine_status",
        "platelets_status", "bun_status",
    ]
    other_keys = ["wbc_status", "creatinine_status", "platelets_status", "bun_status"]

    lactate_critical_hours = sum(
        1 for hour in drawn
        if hour.get("flags", {}).get("lactate_status") == "critical"
    )
    others_over_half = sum(
        1 for key in other_keys
        if sum(
            1 for hour in drawn
            if _is_abnormal_lab_flag(hour.get("flags", {}).get(key, "not_drawn"))
        ) > half
    )
    if lactate_critical_hours > half and others_over_half >= 1:
        return "CRITICAL"

    simultaneous_2plus = sum(
        1 for hour in drawn
        if sum(
            1 for key in lab_keys
            if _is_abnormal_lab_flag(hour.get("flags", {}).get(key, "not_drawn"))
        ) >= 2
    )
    if simultaneous_2plus > half:
        return "DETERIORATING"

    any_abnormal = any(
        _is_abnormal_lab_flag(hour.get("flags", {}).get(key, "not_drawn"))
        for hour in drawn
        for key in lab_keys
    )
    if any_abnormal:
        return "WATCH"

    return "STABLE"


@app.get("/patients/{patient_id}/labs")
def get_labs_window(patient_id: str, hours_back: int = Query(12, ge=1, le=200),
                     up_to_hour: Optional[int] = None):
    """
    Tool endpoint for the Lab Agent. Labs are drawn far less often than
    vitals, so a longer default window is used. Missing values are
    returned as null -- the Lab Agent should treat sparse labs as
    meaningful, not silently fill them in.
    Also returns deterministic normal/abnormal flags for key labs so the
    agent does not have to compare numbers against thresholds itself.
    """
    conn = _get_conn()
    if not _patient_exists(conn, patient_id):
        conn.close()
        raise HTTPException(404, f"Unknown patient_id: {patient_id}")

    if up_to_hour is None:
        up_to_hour = conn.execute(
            "SELECT MAX(icu_hour) FROM hourly_records WHERE patient_id = ?",
            (patient_id,),
        ).fetchone()[0]

    rows = conn.execute("""
        SELECT icu_hour, base_excess, hco3, fio2, ph, paco2, sao2, ast, bun,
               alkalinephos, calcium, chloride, creatinine, bilirubin_direct,
               glucose, lactate, magnesium, phosphate, potassium,
               bilirubin_total, troponin_i, hct, hgb, ptt, wbc, fibrinogen,
               platelets
        FROM hourly_records
        WHERE patient_id = ? AND icu_hour <= ? AND icu_hour > ?
        ORDER BY icu_hour
    """, (patient_id, up_to_hour, up_to_hour - hours_back)).fetchall()
    conn.close()

    window = []
    any_abnormal = False
    labs_drawn_count = 0
    for r in rows:
        hour = dict(r)
        flags = _labs_flags(hour)
        hour["flags"] = flags
        if any(v is not None for k, v in hour.items() if k not in ("icu_hour", "flags")):
            labs_drawn_count += 1
        if any(v not in ("normal", "not_drawn") for v in flags.values()):
            any_abnormal = True
        window.append(hour)

    return {
        "patient_id": patient_id,
        "up_to_hour": up_to_hour,
        "window": window,
        "hours_with_any_lab_drawn": labs_drawn_count,
        "labs_drawn_count": labs_drawn_count,
        "hours_requested": hours_back,
        "any_abnormal_labs_in_window": any_abnormal,
        "computed_verdict": compute_labs_verdict(window, labs_drawn_count),
    }


def compute_baseline_risk(age: float, icu_type: str) -> dict:
    """Deterministic baseline risk from age (icu_type reserved for later use)."""
    if age >= 80:
        age_risk_category = "high"
        baseline_risk_level = "HIGH"
    elif age >= 65:
        age_risk_category = "elevated"
        baseline_risk_level = "ELEVATED"
    elif age >= 40:
        age_risk_category = "standard"
        baseline_risk_level = "MODERATE"
    else:
        age_risk_category = "standard"
        baseline_risk_level = "LOW"
    return {
        "age_risk_category": age_risk_category,
        "baseline_risk_level": baseline_risk_level,
    }


@app.get("/patients/{patient_id}/demographics")
def get_demographics(patient_id: str):
    """Tool endpoint for the Demographic/Risk Agent."""
    conn = _get_conn()
    row = conn.execute("""
        SELECT patient_id, age, gender, unit1, unit2, hosp_adm_time
        FROM hourly_records WHERE patient_id = ? LIMIT 1
    """, (patient_id,)).fetchone()
    conn.close()
    if row is None:
        raise HTTPException(404, f"Unknown patient_id: {patient_id}")
    d = dict(row)
    d["gender_label"] = "male" if d["gender"] == 1 else "female"
    d["icu_type"] = "MICU/SICU (Unit1)" if d.get("unit1") == 1 else (
        "Cardiac/Surgical (Unit2)" if d.get("unit2") == 1 else "unspecified")
    d["risk_assessment"] = compute_baseline_risk(d["age"], d["icu_type"])
    return d


@app.get("/patients/{patient_id}/trajectory")
def get_trajectory_so_far(patient_id: str, up_to_hour: Optional[int] = None):
    """
    Tool endpoint for the Historical Pattern Agent -- this patient's own
    course so far in the current encounter (not other patients).
    """
    conn = _get_conn()
    if not _patient_exists(conn, patient_id):
        conn.close()
        raise HTTPException(404, f"Unknown patient_id: {patient_id}")
    q = "SELECT icu_hour, hr, resp, lactate, wbc, sepsis_label FROM hourly_records WHERE patient_id = ?"
    params = [patient_id]
    if up_to_hour is not None:
        q += " AND icu_hour <= ?"
        params.append(up_to_hour)
    q += " ORDER BY icu_hour"
    rows = conn.execute(q, params).fetchall()
    conn.close()
    return {"patient_id": patient_id, "trajectory": [dict(r) for r in rows]}


@app.get("/cohort/outcomes")
def get_cohort_outcomes(min_lactate: Optional[float] = None,
                         min_resp: Optional[float] = None,
                         age_min: Optional[int] = None,
                         age_max: Optional[int] = None):
    """
    Tool endpoint for the Historical Pattern Agent's population-level
    query -- e.g. "of patients with lactate >= X and resp >= Y in this
    age range, what fraction were ever labeled septic, and out of how
    many." Always returns the sample size alongside the rate so the
    agent (per its Constraints) can flag low-confidence stats when n
    is small.
    """
    conn = _get_conn()
    q = """
        SELECT DISTINCT patient_id, MAX(sepsis_label) OVER (PARTITION BY patient_id) as ever_septic
        FROM hourly_records
        WHERE 1=1
    """
    params = []
    if min_lactate is not None:
        q += " AND lactate >= ?"
        params.append(min_lactate)
    if min_resp is not None:
        q += " AND resp >= ?"
        params.append(min_resp)
    if age_min is not None:
        q += " AND age >= ?"
        params.append(age_min)
    if age_max is not None:
        q += " AND age <= ?"
        params.append(age_max)

    rows = conn.execute(q, params).fetchall()
    conn.close()

    seen = {}
    for r in rows:
        seen[r["patient_id"]] = r["ever_septic"]
    n = len(seen)
    septic_n = sum(1 for v in seen.values() if v)
    return {
        "sample_size": n,
        "septic_count": septic_n,
        "septic_rate": (septic_n / n) if n > 0 else None,
        "filters_applied": {
            "min_lactate": min_lactate, "min_resp": min_resp,
            "age_min": age_min, "age_max": age_max,
        },
    }


@app.get("/patients/{patient_id}/ground_truth")
def get_ground_truth(patient_id: str):
    """
    NOT a tool the agents should ever call -- this is for the evaluation
    step only (Week 4: comparing verdicts against real labeled outcomes).
    Keep this endpoint out of any agent's tool list.
    """
    conn = _get_conn()
    rows = conn.execute("""
        SELECT icu_hour, sepsis_label FROM hourly_records
        WHERE patient_id = ? ORDER BY icu_hour
    """, (patient_id,)).fetchall()
    conn.close()
    if not rows:
        raise HTTPException(404, f"Unknown patient_id: {patient_id}")
    onset_hour = next((r["icu_hour"] for r in rows if r["sepsis_label"] == 1), None)
    return {
        "patient_id": patient_id,
        "sepsis_onset_hour": onset_hour,
        "labels_by_hour": [dict(r) for r in rows],
    }
