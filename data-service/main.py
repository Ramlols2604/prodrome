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
    }


@app.get("/patients/{patient_id}/labs")
def get_labs_window(patient_id: str, hours_back: int = Query(12, ge=1, le=200),
                     up_to_hour: Optional[int] = None):
    """
    Tool endpoint for the Lab Agent. Labs are drawn far less often than
    vitals, so a longer default window is used. Missing values are
    returned as null -- the Lab Agent should treat sparse labs as
    meaningful, not silently fill them in.
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

    non_null_rows = [dict(r) for r in rows if any(v is not None for k, v in dict(r).items() if k != "icu_hour")]
    return {
        "patient_id": patient_id,
        "up_to_hour": up_to_hour,
        "window": [dict(r) for r in rows],
        "hours_with_any_lab_drawn": len(non_null_rows),
        "hours_requested": hours_back,
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
