"""Dissent-score experiment: does committee disagreement predict outcome?

Replays each eval patient hour-by-hour with baseline (non-persistent)
vitals/labs verdicts. No LLM calls. Does not modify evaluation or rule code.
"""

from __future__ import annotations

import csv
import statistics
from pathlib import Path

from evaluate import (
    LABS_HOURS_BACK,
    LABS_KEYS,
    MIN_HOUR,
    TRAJ_KEYS,
    VITALS_HOURS_BACK,
    VITALS_KEYS,
    _get_conn,
    _list_patients,
    _slim,
    _window,
)
from judge import compute_committee_verdict, verdict_severity
from main import (
    _labs_flags,
    _vitals_flags,
    compute_labs_verdict,
    compute_trajectory_trend,
    compute_vitals_verdict,
)

OUT_CSV = Path(__file__).resolve().parent / "dissent_results.csv"

BUCKETS = (
    ("Consensus", lambda d: d == 0.0),
    ("Mild disagreement", lambda d: 0.0 < d <= 33.3),
    ("Major disagreement", lambda d: d > 33.3),
)


def _bucket_name(dissent: float) -> str:
    for name, pred in BUCKETS:
        if pred(dissent):
            return name
    return "Major disagreement"


def replay_patient(conn, patient_id: str, max_hour: int) -> dict:
    records = conn.execute(
        "SELECT * FROM hourly_records WHERE patient_id = ? ORDER BY icu_hour",
        (patient_id,),
    ).fetchall()
    rows_by_hour = {r["icu_hour"]: r for r in records}

    max_dissent = 0.0
    max_severity = 0
    for h in range(MIN_HOUR, max_hour + 1):
        vitals_window = []
        for row in _window(rows_by_hour, h, VITALS_HOURS_BACK):
            hour = _slim(row, VITALS_KEYS)
            hour["flags"] = _vitals_flags(hour)
            vitals_window.append(hour)

        labs_window = []
        labs_drawn_count = 0
        for row in _window(rows_by_hour, h, LABS_HOURS_BACK):
            hour = _slim(row, LABS_KEYS)
            hour["flags"] = _labs_flags(hour)
            if any(v is not None for k, v in hour.items() if k not in ("icu_hour", "flags")):
                labs_drawn_count += 1
            labs_window.append(hour)

        trajectory = [
            _slim(rows_by_hour[hour], TRAJ_KEYS)
            for hour in sorted(rows_by_hour)
            if hour <= h
        ]
        scoring = compute_committee_verdict(
            compute_vitals_verdict(vitals_window),
            compute_labs_verdict(labs_window, labs_drawn_count),
            compute_trajectory_trend(trajectory)["overall_trajectory"],
        )
        severity = verdict_severity(scoring["committee_verdict"])
        dissent = float(scoring["dissent_score"])
        if dissent > max_dissent:
            max_dissent = dissent
        if severity > max_severity:
            max_severity = severity

    return {
        "max_dissent_score": max_dissent,
        "max_severity_reached": max_severity,
    }


def _fmt_pct(n: int, d: int) -> str:
    if d == 0:
        return "n/a"
    return f"{100.0 * n / d:.1f}%"


def _fmt_num(value: float | None, digits: int = 2) -> str:
    if value is None:
        return "n/a"
    return f"{value:.{digits}f}"


def main() -> None:
    conn = _get_conn()
    patients = _list_patients(conn)
    results = []
    for i, meta in enumerate(patients, start=1):
        is_septic = int(meta["ever_septic"] or 0) == 1
        replay = replay_patient(conn, meta["patient_id"], int(meta["max_hour"]))
        max_dissent = replay["max_dissent_score"]
        results.append({
            "patient_id": meta["patient_id"],
            "is_septic": int(is_septic),
            "max_dissent_score": max_dissent,
            "dissent_bucket": _bucket_name(max_dissent),
            "max_severity_reached": replay["max_severity_reached"],
        })
        if i % 50 == 0 or i == len(patients):
            print(f"  processed {i}/{len(patients)}", flush=True)
    conn.close()

    with OUT_CSV.open("w", newline="") as f:
        writer = csv.DictWriter(
            f,
            fieldnames=[
                "patient_id",
                "is_septic",
                "max_dissent_score",
                "dissent_bucket",
                "max_severity_reached",
            ],
        )
        writer.writeheader()
        writer.writerows(results)

    print()
    print("=== Dissent experiment (baseline committee, no LLM) ===")
    print("Max dissent_score over the full encounter; WATCH+ = max_severity >= 1")
    print(f"Patients: {len(results)}")
    print()
    header = (
        f"{'bucket':<22} {'n_patients':>10} {'pct_septic':>12} "
        f"{'watch+_prec':>12} {'mean_max_sev':>13} {'median_max_sev':>14}"
    )
    print(header)
    print("-" * len(header))

    for name, pred in BUCKETS:
        bucket = [r for r in results if pred(r["max_dissent_score"])]
        n = len(bucket)
        n_septic = sum(1 for r in bucket if r["is_septic"])
        watch_plus = [r for r in bucket if r["max_severity_reached"] >= 1]
        watch_tp = sum(1 for r in watch_plus if r["is_septic"])
        sevs = [r["max_severity_reached"] for r in bucket]
        print(
            f"{name:<22} {n:>10} "
            f"{_fmt_pct(n_septic, n):>12} "
            f"{_fmt_pct(watch_tp, len(watch_plus)):>12} "
            f"{_fmt_num(statistics.mean(sevs) if sevs else None):>13} "
            f"{_fmt_num(statistics.median(sevs) if sevs else None, 1):>14}"
        )
        print(
            f"{'':22}   septic={n_septic}/{n}  "
            f"WATCH+={len(watch_plus)} (TP={watch_tp} FP={len(watch_plus) - watch_tp})"
        )

    print()
    print(f"Wrote {OUT_CSV} ({len(results)} rows)")


if __name__ == "__main__":
    main()
