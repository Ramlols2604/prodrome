"""Build a pre-onset 6-hour sepsis forecast table from the full PhysioNet download.

Scans physionet_data/training/ (not eval_data/). No LLM. Features at hour t
use only data up to t. Hour indexing matches data_loader/evaluate: 0-based
row index (icu_hour), MIN_HOUR=6, trailing 6h vitals / 12h labs windows.
"""

from __future__ import annotations

import csv
import random
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent
AGENTS_DIR = ROOT.parent / "agents"
sys.path.insert(0, str(AGENTS_DIR))

from evaluate import (  # noqa: E402
    LABS_HOURS_BACK,
    LABS_KEYS,
    MIN_HOUR,
    TRAJ_KEYS,
    VITALS_HOURS_BACK,
    VITALS_KEYS,
    _window,
)
from judge import compute_committee_verdict, trajectory_severity  # noqa: E402
from main import (  # noqa: E402
    _labs_flags,
    _vitals_flags,
    compute_labs_verdict,
    compute_trajectory_trend,
    compute_vitals_verdict,
)

SRC_DIR = ROOT / "physionet_data" / "training"
OUT_CSV = ROOT / "forecast_dataset.csv"
HORIZON = 6
MAX_ROWS_PER_PATIENT = 3
SEED = 42
FUTURE_HOURS = HORIZON  # t+1 .. t+HORIZON must exist

FIELDNAMES = [
    "patient_id",
    "hour",
    "forecast_label",
    "vitals_severity",
    "labs_severity",
    "dissent_score",
    "trajectory_severity",
    "age",
    "gender",
    "hours_into_encounter",
]

PSV_VITALS = {
    "HR": "hr",
    "O2Sat": "o2sat",
    "Temp": "temp",
    "SBP": "sbp",
    "MAP": "map",
    "DBP": "dbp",
    "Resp": "resp",
    "EtCO2": "etco2",
}
PSV_LABS = {
    "BaseExcess": "base_excess",
    "HCO3": "hco3",
    "FiO2": "fio2",
    "pH": "ph",
    "PaCO2": "paco2",
    "SaO2": "sao2",
    "AST": "ast",
    "BUN": "bun",
    "Alkalinephos": "alkalinephos",
    "Calcium": "calcium",
    "Chloride": "chloride",
    "Creatinine": "creatinine",
    "Bilirubin_direct": "bilirubin_direct",
    "Glucose": "glucose",
    "Lactate": "lactate",
    "Magnesium": "magnesium",
    "Phosphate": "phosphate",
    "Potassium": "potassium",
    "Bilirubin_total": "bilirubin_total",
    "TroponinI": "troponin_i",
    "Hct": "hct",
    "Hgb": "hgb",
    "PTT": "ptt",
    "WBC": "wbc",
    "Fibrinogen": "fibrinogen",
    "Platelets": "platelets",
}


def _parse_float(raw: str | None) -> float | None:
    if raw is None:
        return None
    text = raw.strip()
    if not text or text.lower() == "nan":
        return None
    try:
        return float(text)
    except ValueError:
        return None


def _parse_sepsis(raw: str | None) -> int:
    value = _parse_float(raw)
    if value is None:
        return 0
    return 1 if value >= 1 else 0


def load_patient(path: Path) -> tuple[str, list[dict]]:
    """Return (patient_id, hourly records with 0-based icu_hour)."""
    patient_id = path.stem
    records: list[dict] = []
    with path.open(newline="") as f:
        reader = csv.DictReader(f, delimiter="|")
        if not reader.fieldnames or "SepsisLabel" not in reader.fieldnames:
            raise ValueError(f"{path.name} is missing a SepsisLabel column")
        for i, raw in enumerate(reader):
            rec: dict = {
                "icu_hour": i,
                "sepsis_label": _parse_sepsis(raw.get("SepsisLabel")),
                "age": _parse_float(raw.get("Age")),
                "gender": _parse_float(raw.get("Gender")),
            }
            if rec["gender"] is not None:
                rec["gender"] = int(rec["gender"])
            for psv_key, internal in PSV_VITALS.items():
                rec[internal] = _parse_float(raw.get(psv_key))
            for psv_key, internal in PSV_LABS.items():
                rec[internal] = _parse_float(raw.get(psv_key))
            records.append(rec)
    return patient_id, records


def _onset_hour(records: list[dict]) -> int | None:
    for rec in records:
        if rec["sepsis_label"] == 1:
            return int(rec["icu_hour"])
    return None


def _eligible_hours(records: list[dict]) -> list[tuple[int, int]]:
    """(t, forecast_label) for t in [6, max_hour-6] with no sepsis at or before t."""
    if not records:
        return []
    max_hour = int(records[-1]["icu_hour"])
    labels = {int(r["icu_hour"]): int(r["sepsis_label"]) for r in records}
    onset = _onset_hour(records)
    eligible: list[tuple[int, int]] = []
    last_t = max_hour - FUTURE_HOURS
    for t in range(MIN_HOUR, last_t + 1):
        if onset is not None and t >= onset:
            continue
        if any(labels.get(h, 0) == 1 for h in range(t + 1, t + FUTURE_HOURS + 1)):
            forecast_label = 1
        else:
            forecast_label = 0
        eligible.append((t, forecast_label))
    return eligible


def _features_at(rows_by_hour: dict[int, dict], t: int) -> dict:
    vitals_window = []
    for row in _window(rows_by_hour, t, VITALS_HOURS_BACK):
        hour = {k: row.get(k) for k in VITALS_KEYS}
        hour["flags"] = _vitals_flags(hour)
        vitals_window.append(hour)

    labs_window = []
    labs_drawn_count = 0
    for row in _window(rows_by_hour, t, LABS_HOURS_BACK):
        hour = {k: row.get(k) for k in LABS_KEYS}
        hour["flags"] = _labs_flags(hour)
        if any(v is not None for k, v in hour.items() if k not in ("icu_hour", "flags")):
            labs_drawn_count += 1
        labs_window.append(hour)

    trajectory = [
        {k: rows_by_hour[h].get(k) for k in TRAJ_KEYS}
        for h in sorted(rows_by_hour)
        if h <= t
    ]
    vitals_verdict = compute_vitals_verdict(vitals_window)
    labs_verdict = compute_labs_verdict(labs_window, labs_drawn_count)
    overall = compute_trajectory_trend(trajectory)["overall_trajectory"]
    scoring = compute_committee_verdict(vitals_verdict, labs_verdict, overall)
    return {
        "vitals_severity": scoring["vitals_severity"],
        "labs_severity": scoring["labs_severity"],
        "dissent_score": scoring["dissent_score"],
        "trajectory_severity": trajectory_severity(overall),
    }


def _static_demo(records: list[dict]) -> tuple[float | None, int | None]:
    age = next((r["age"] for r in records if r.get("age") is not None), None)
    gender = next((r["gender"] for r in records if r.get("gender") is not None), None)
    return age, gender


def main() -> None:
    if not SRC_DIR.exists():
        raise FileNotFoundError(
            f"{SRC_DIR} not found. Run ./download_data.sh first."
        )
    psv_files = sorted(SRC_DIR.glob("*.psv"))
    if not psv_files:
        raise FileNotFoundError(f"No .psv files found in {SRC_DIR}")

    random.seed(SEED)
    started = time.time()
    n_scanned = 0
    n_before = 0
    n_leak = 0
    out_rows: list[dict] = []

    for i, path in enumerate(psv_files, start=1):
        patient_id, records = load_patient(path)
        n_scanned += 1
        if not records:
            continue
        onset = _onset_hour(records)
        eligible = _eligible_hours(records)
        n_before += len(eligible)
        if len(eligible) > MAX_ROWS_PER_PATIENT:
            sampled = random.sample(eligible, MAX_ROWS_PER_PATIENT)
        else:
            sampled = list(eligible)
        sampled.sort(key=lambda x: x[0])

        rows_by_hour = {int(r["icu_hour"]): r for r in records}
        age, gender = _static_demo(records)
        for t, forecast_label in sampled:
            if onset is not None and t >= onset:
                n_leak += 1
                continue
            feats = _features_at(rows_by_hour, t)
            out_rows.append(
                {
                    "patient_id": patient_id,
                    "hour": t,
                    "forecast_label": forecast_label,
                    "vitals_severity": feats["vitals_severity"],
                    "labs_severity": feats["labs_severity"],
                    "dissent_score": feats["dissent_score"],
                    "trajectory_severity": feats["trajectory_severity"],
                    "age": age,
                    "gender": gender,
                    "hours_into_encounter": t,
                }
            )

        if i % 1000 == 0 or i == len(psv_files):
            elapsed = time.time() - started
            print(
                f"  processed {i}/{len(psv_files)}  "
                f"eligible={n_before} sampled={len(out_rows)}  "
                f"({elapsed:.0f}s)",
                flush=True,
            )

    with OUT_CSV.open("w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=FIELDNAMES)
        writer.writeheader()
        writer.writerows(out_rows)

    n_after = len(out_rows)
    n_pos = sum(1 for r in out_rows if r["forecast_label"] == 1)
    pos_rate = (100.0 * n_pos / n_after) if n_after else 0.0
    leak_ok = n_leak == 0
    elapsed = time.time() - started

    print()
    print("=== Forecast dataset ===")
    print(f"Patients scanned:                         {n_scanned}")
    print(f"Eligible (patient, t) pairs before sample: {n_before}")
    print(f"After sampling (<=3 per patient):         {n_after}")
    print(
        f"Positive label rate (forecast_label==1):  "
        f"{pos_rate:.1f}%  ({n_pos}/{n_after})"
    )
    print(
        f"Onset leak check (hour >= sepsis onset):  "
        f"{'PASS' if leak_ok else 'FAIL'}  ({n_leak} rows)"
    )
    print(f"Wrote {OUT_CSV} ({n_after} rows) in {elapsed:.0f}s")


if __name__ == "__main__":
    main()
