"""Deterministic committee evaluation against PhysioNet ground truth.

No LLM calls. Replays each eval patient hour-by-hour using the same
vitals/labs/trajectory classification functions as the live service.
"""

from __future__ import annotations

import csv
import sqlite3
import statistics
import sys
from pathlib import Path

from data_loader import DB_PATH
from main import (
    _labs_flags,
    _vitals_flags,
    compute_labs_verdict,
    compute_labs_verdict_persistent,
    compute_trajectory_trend,
    compute_vitals_verdict,
    compute_vitals_verdict_persistent,
)

AGENTS_DIR = Path(__file__).resolve().parents[1] / "agents"
sys.path.insert(0, str(AGENTS_DIR))
from judge import (  # noqa: E402
    compute_committee_verdict,
    compute_committee_verdict_persistent,
    verdict_severity,
)

OUT_CSV = Path(__file__).resolve().parent / "eval_results.csv"
OUT_CSV_PERSISTENT = Path(__file__).resolve().parent / "eval_results_persistent.csv"
VITALS_HOURS_BACK = 6
LABS_HOURS_BACK = 12
MIN_HOUR = 6

VITALS_KEYS = ["icu_hour", "hr", "o2sat", "temp", "sbp", "map", "dbp", "resp", "etco2"]
LABS_KEYS = [
    "icu_hour", "base_excess", "hco3", "fio2", "ph", "paco2", "sao2", "ast", "bun",
    "alkalinephos", "calcium", "chloride", "creatinine", "bilirubin_direct",
    "glucose", "lactate", "magnesium", "phosphate", "potassium",
    "bilirubin_total", "troponin_i", "hct", "hgb", "ptt", "wbc", "fibrinogen",
    "platelets",
]
TRAJ_KEYS = ["icu_hour", "hr", "resp", "lactate", "wbc"]


def _get_conn() -> sqlite3.Connection:
    if not Path(DB_PATH).exists():
        raise FileNotFoundError(
            f"{DB_PATH} not found. Run `python data_loader.py --data-dir eval_data` first."
        )
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def _slim(row: sqlite3.Row, keys: list[str]) -> dict:
    d = dict(row)
    return {k: d.get(k) for k in keys}


def _window(rows_by_hour: dict[int, sqlite3.Row], up_to_hour: int, hours_back: int):
    start = up_to_hour - hours_back
    return [
        rows_by_hour[h]
        for h in range(start + 1, up_to_hour + 1)
        if h in rows_by_hour
    ]


def _list_patients(conn: sqlite3.Connection) -> list[dict]:
    rows = conn.execute("""
        SELECT patient_id,
               MAX(icu_hour) AS max_hour,
               MAX(sepsis_label) AS ever_septic
        FROM hourly_records
        GROUP BY patient_id
        ORDER BY patient_id
    """).fetchall()
    return [dict(r) for r in rows]


def _sepsis_onset_hour(conn: sqlite3.Connection, patient_id: str) -> int | None:
    rows = conn.execute("""
        SELECT icu_hour, sepsis_label FROM hourly_records
        WHERE patient_id = ? ORDER BY icu_hour
    """, (patient_id,)).fetchall()
    return next((r["icu_hour"] for r in rows if r["sepsis_label"] == 1), None)


def evaluate_patient(
    conn: sqlite3.Connection,
    patient_id: str,
    max_hour: int,
    vitals_fn,
    labs_fn,
    committee_fn,
) -> dict:
    records = conn.execute("""
        SELECT * FROM hourly_records
        WHERE patient_id = ? ORDER BY icu_hour
    """, (patient_id,)).fetchall()
    rows_by_hour = {r["icu_hour"]: r for r in records}

    max_severity_so_far = 0
    first_watch_hour = None
    first_deteriorating_hour = None
    first_critical_hour = None
    dissent_at_deteriorating = None

    for h in range(MIN_HOUR, max_hour + 1):
        vitals_rows = _window(rows_by_hour, h, VITALS_HOURS_BACK)
        labs_rows = _window(rows_by_hour, h, LABS_HOURS_BACK)
        traj_rows = [
            rows_by_hour[hour]
            for hour in sorted(rows_by_hour)
            if hour <= h
        ]

        vitals_window = []
        for row in vitals_rows:
            hour = _slim(row, VITALS_KEYS)
            hour["flags"] = _vitals_flags(hour)
            vitals_window.append(hour)

        labs_window = []
        labs_drawn_count = 0
        for row in labs_rows:
            hour = _slim(row, LABS_KEYS)
            hour["flags"] = _labs_flags(hour)
            if any(v is not None for k, v in hour.items() if k not in ("icu_hour", "flags")):
                labs_drawn_count += 1
            labs_window.append(hour)

        trajectory = [_slim(row, TRAJ_KEYS) for row in traj_rows]
        vitals_verdict = vitals_fn(vitals_window)
        labs_verdict = labs_fn(labs_window, labs_drawn_count)
        historical_trajectory = compute_trajectory_trend(trajectory)["overall_trajectory"]
        scoring = committee_fn(
            vitals_verdict, labs_verdict, historical_trajectory,
        )
        committee_severity = verdict_severity(scoring["committee_verdict"])
        if committee_severity > max_severity_so_far:
            max_severity_so_far = committee_severity

        if first_watch_hour is None and max_severity_so_far >= 1:
            first_watch_hour = h
        if first_deteriorating_hour is None and max_severity_so_far >= 2:
            first_deteriorating_hour = h
            dissent_at_deteriorating = scoring["dissent_score"]
        if first_critical_hour is None and max_severity_so_far >= 3:
            first_critical_hour = h

        if first_critical_hour is not None:
            break

    return {
        "first_watch_hour": first_watch_hour,
        "first_deteriorating_hour": first_deteriorating_hour,
        "first_critical_hour": first_critical_hour,
        "dissent_score_at_alert": dissent_at_deteriorating,
        "max_severity_reached": max_severity_so_far,
    }


def _fmt_rate(n: int, d: int) -> str:
    if d == 0:
        return "n/a"
    return f"{n / d:.3f}"


def _fmt_hours(value: float | None) -> str:
    if value is None:
        return "n/a"
    return f"{value:.2f}"


def _threshold_metrics(results: list[dict], alert_hour_key: str) -> dict:
    septic = [r for r in results if r["is_septic"]]
    non_septic = [r for r in results if not r["is_septic"]]
    tp = [r for r in septic if r[alert_hour_key] is not None]
    tn = [r for r in non_septic if r[alert_hour_key] is None]
    fp = [r for r in non_septic if r[alert_hour_key] is not None]
    lead_times = []
    late = 0
    for r in tp:
        onset = r["sepsis_onset_hour"]
        alert_hour = r[alert_hour_key]
        if onset is None or alert_hour is None:
            continue
        lead_times.append(onset - alert_hour)
        if alert_hour > onset:
            late += 1
    return {
        "n_septic": len(septic),
        "n_non_septic": len(non_septic),
        "tp": len(tp),
        "tn": len(tn),
        "fp": len(fp),
        "sensitivity": (len(tp) / len(septic)) if septic else None,
        "specificity": (len(tn) / len(non_septic)) if non_septic else None,
        "fp_rate": (len(fp) / len(non_septic)) if non_septic else None,
        "mean_lead": statistics.mean(lead_times) if lead_times else None,
        "median_lead": statistics.median(lead_times) if lead_times else None,
        "late": late,
        "n_lead": len(lead_times),
    }


CSV_FIELDS = [
    "patient_id",
    "is_septic",
    "sepsis_onset_hour",
    "alert_hour",
    "lead_time",
    "dissent_score_at_alert",
    "first_watch_hour",
    "first_deteriorating_hour",
    "first_critical_hour",
]

THRESHOLDS = [
    ("A  WATCH+", "first_watch_hour", "severity >= 1"),
    ("B  DETERIORATING+", "first_deteriorating_hour", "severity >= 2"),
    ("C  CRITICAL", "first_critical_hour", "severity >= 3"),
]


def run_pass(conn, patients, vitals_fn, labs_fn, committee_fn, label: str) -> list[dict]:
    results = []
    for i, meta in enumerate(patients, start=1):
        patient_id = meta["patient_id"]
        is_septic = int(meta["ever_septic"] or 0) == 1
        onset = _sepsis_onset_hour(conn, patient_id) if is_septic else None
        eval_row = evaluate_patient(
            conn, patient_id, int(meta["max_hour"]),
            vitals_fn, labs_fn, committee_fn,
        )
        alert_hour = eval_row["first_deteriorating_hour"]
        lead_time = None
        if is_septic and onset is not None and alert_hour is not None:
            lead_time = onset - alert_hour
        results.append({
            "patient_id": patient_id,
            "is_septic": int(is_septic),
            "sepsis_onset_hour": onset,
            "alert_hour": alert_hour,
            "lead_time": lead_time,
            "dissent_score_at_alert": eval_row["dissent_score_at_alert"],
            "first_watch_hour": eval_row["first_watch_hour"],
            "first_deteriorating_hour": eval_row["first_deteriorating_hour"],
            "first_critical_hour": eval_row["first_critical_hour"],
            "max_severity_reached": eval_row["max_severity_reached"],
        })
        if i % 50 == 0 or i == len(patients):
            print(f"  [{label}] processed {i}/{len(patients)}", flush=True)
    return results


def write_results(path: Path, results: list[dict]) -> None:
    with path.open("w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=CSV_FIELDS, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(results)


def print_sweep_table(title: str, results: list[dict]) -> None:
    metrics_by_label = {
        label: _threshold_metrics(results, hour_key)
        for label, hour_key, _ in THRESHOLDS
    }
    n_septic = sum(1 for r in results if r["is_septic"])
    n_non_septic = len(results) - n_septic
    print()
    print(f"=== {title} ===")
    print(f"Patients: {len(results)} ({n_septic} septic, {n_non_septic} non-septic)")
    header = (
        f"{'Threshold':<22} {'Sensitivity':>12} {'Specificity':>12} "
        f"{'FP Rate':>10} {'Mean Lead':>12} {'Median Lead':>12}"
    )
    print(header)
    print("-" * len(header))
    for label, hour_key, _desc in THRESHOLDS:
        m = metrics_by_label[label]
        print(
            f"{label:<22} "
            f"{_fmt_rate(m['tp'], m['n_septic']):>12} "
            f"{_fmt_rate(m['tn'], m['n_non_septic']):>12} "
            f"{_fmt_rate(m['fp'], m['n_non_septic']):>10} "
            f"{_fmt_hours(m['mean_lead']):>12} "
            f"{_fmt_hours(m['median_lead']):>12}"
        )
    print("Counts (TP / TN / FP) and late catches:")
    for label, hour_key, desc in THRESHOLDS:
        m = metrics_by_label[label]
        print(
            f"  {label} ({desc}): "
            f"TP={m['tp']}/{m['n_septic']}  TN={m['tn']}/{m['n_non_septic']}  "
            f"FP={m['fp']}/{m['n_non_septic']}  "
            f"late={m['late']}/{m['tp']}"
        )


def main() -> None:
    conn = _get_conn()
    patients = _list_patients(conn)
    print("Pass 1/2: BASELINE (no persistence)")
    baseline = run_pass(
        conn, patients,
        compute_vitals_verdict, compute_labs_verdict, compute_committee_verdict,
        "baseline",
    )
    print("Pass 2/2: PERSISTENCE-FILTERED (2-of-3 hours)")
    persistent = run_pass(
        conn, patients,
        compute_vitals_verdict_persistent,
        compute_labs_verdict_persistent,
        compute_committee_verdict_persistent,
        "persistent",
    )
    conn.close()

    write_results(OUT_CSV, baseline)
    write_results(OUT_CSV_PERSISTENT, persistent)

    print()
    print("=== Prodrome evaluation (deterministic committee, no LLM) ===")
    print("Voters: vitals + labs + historical trajectory (encounter-so-far)")
    print("Severity is committee_verdict: STABLE=0 WATCH=1 DETERIORATING=2 CRITICAL=3")
    print_sweep_table("BASELINE (no persistence)", baseline)
    print_sweep_table("PERSISTENCE-FILTERED (2-of-3 hours)", persistent)
    print()
    print("alert_hour / lead_time / dissent_score_at_alert = Threshold B (DETERIORATING+)")
    print(f"Wrote {OUT_CSV} ({len(baseline)} rows)")
    print(f"Wrote {OUT_CSV_PERSISTENT} ({len(persistent)} rows)")


if __name__ == "__main__":
    main()
