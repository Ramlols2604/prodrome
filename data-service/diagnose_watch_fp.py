"""Read-only diagnostic: inspect WATCH+ false positives from eval_results.csv.

Does not modify verdict functions or evaluate.py logic.
"""

from __future__ import annotations

import csv
import random
import statistics
from pathlib import Path

from evaluate import (
    LABS_HOURS_BACK,
    LABS_KEYS,
    OUT_CSV,
    TRAJ_KEYS,
    VITALS_HOURS_BACK,
    VITALS_KEYS,
    _get_conn,
    _slim,
    _window,
)
from judge import compute_committee_verdict, verdict_severity
from main import (
    _is_abnormal_lab_flag,
    _is_abnormal_vital_flag,
    _labs_flags,
    _vitals_flags,
    compute_labs_verdict,
    compute_trajectory_trend,
    compute_vitals_verdict,
)

SAMPLE_SIZE = 20
SEED = 42

# flag_key + status -> (raw value key, threshold, "above"|"below")
FLAG_RULES = {
    ("hr_status", "tachycardia"): ("hr", 100, "above"),
    ("hr_status", "bradycardia"): ("hr", 60, "below"),
    ("map_status", "low_perfusion_concern"): ("map", 65, "below"),
    ("sbp_status", "hypotension"): ("sbp", 90, "below"),
    ("sbp_status", "hypertension_concern"): ("sbp", 180, "above"),
    ("resp_status", "tachypnea"): ("resp", 24, "above"),
    ("resp_status", "bradypnea"): ("resp", 12, "below"),
    ("temp_status", "fever"): ("temp", 38.3, "above"),
    ("temp_status", "hypothermia"): ("temp", 36, "below"),
    ("lactate_status", "elevated"): ("lactate", 2.0, "above"),
    ("lactate_status", "critical"): ("lactate", 4.0, "above"),
    ("wbc_status", "leukocytosis"): ("wbc", 12.0, "above"),
    ("wbc_status", "leukopenia"): ("wbc", 4.0, "below"),
    ("creatinine_status", "elevated"): ("creatinine", 1.2, "above"),
    ("platelets_status", "thrombocytopenia"): ("platelets", 150, "below"),
    ("bun_status", "elevated"): ("bun", 20, "above"),
}


def _parse_optional_int(raw) -> int | None:
    if raw is None or raw == "":
        return None
    return int(float(raw))


def _is_non_septic(raw) -> bool:
    return str(raw).strip().lower() in {"0", "false", "no"}


def load_watch_false_positives(path: Path) -> list[dict]:
    with path.open(newline="") as f:
        rows = list(csv.DictReader(f))
    fps = []
    for row in rows:
        if not _is_non_septic(row.get("is_septic")):
            continue
        first_watch = _parse_optional_int(row.get("first_watch_hour"))
        if first_watch is None:
            continue
        fps.append({
            "patient_id": row["patient_id"],
            "first_watch_hour": first_watch,
            "first_deteriorating_hour": _parse_optional_int(
                row.get("first_deteriorating_hour")
            ),
            "first_critical_hour": _parse_optional_int(row.get("first_critical_hour")),
        })
    return fps


def _vitals_hour(row) -> dict:
    hour = _slim(row, VITALS_KEYS)
    hour["flags"] = _vitals_flags(hour)
    return hour


def _labs_hour(row) -> dict:
    hour = _slim(row, LABS_KEYS)
    hour["flags"] = _labs_flags(hour)
    return hour


def _windows_at(rows_by_hour: dict, h: int):
    vitals_window = [_vitals_hour(r) for r in _window(rows_by_hour, h, VITALS_HOURS_BACK)]
    labs_window = [_labs_hour(r) for r in _window(rows_by_hour, h, LABS_HOURS_BACK)]
    labs_drawn_count = sum(
        1 for hour in labs_window
        if any(v is not None for k, v in hour.items() if k not in ("icu_hour", "flags"))
    )
    trajectory = [
        _slim(rows_by_hour[hour], TRAJ_KEYS)
        for hour in sorted(rows_by_hour)
        if hour <= h
    ]
    return vitals_window, labs_window, labs_drawn_count, trajectory


def _committee_severity_at(rows_by_hour: dict, h: int) -> int:
    vitals_window, labs_window, labs_drawn_count, trajectory = _windows_at(
        rows_by_hour, h
    )
    scoring = compute_committee_verdict(
        compute_vitals_verdict(vitals_window),
        compute_labs_verdict(labs_window, labs_drawn_count),
        compute_trajectory_trend(trajectory)["overall_trajectory"],
    )
    return verdict_severity(scoring["committee_verdict"])


def _magnitude(value, threshold: float, direction: str) -> float | None:
    if value is None:
        return None
    if direction == "above":
        return float(value) - threshold
    return threshold - float(value)


def _collect_abnormal_flags(window: list[dict], kind: str) -> list[dict]:
    is_abnormal = (
        _is_abnormal_vital_flag if kind == "vitals" else _is_abnormal_lab_flag
    )
    found = []
    for hour in window:
        flags = hour.get("flags") or {}
        for flag_key, status in flags.items():
            if not is_abnormal(status):
                continue
            rule = FLAG_RULES.get((flag_key, status))
            value_key = threshold = direction = None
            value = mag = None
            if rule:
                value_key, threshold, direction = rule
                value = hour.get(value_key)
                mag = _magnitude(value, threshold, direction)
            found.append({
                "kind": kind,
                "flag_key": flag_key,
                "status": status,
                "icu_hour": hour.get("icu_hour"),
                "value_key": value_key,
                "value": value,
                "threshold": threshold,
                "magnitude": mag,
            })
    return found


def _dedupe_flags(flags: list[dict]) -> list[dict]:
    """Keep the largest-magnitude occurrence of each flag_key:status."""
    best: dict[tuple, dict] = {}
    for item in flags:
        key = (item["kind"], item["flag_key"], item["status"])
        prev = best.get(key)
        if prev is None:
            best[key] = item
            continue
        prev_mag = prev["magnitude"]
        new_mag = item["magnitude"]
        if prev_mag is None or (new_mag is not None and new_mag > prev_mag):
            best[key] = item
    return list(best.values())


def _flag_abnormal_on_hour(row, flag_key: str, kind: str) -> bool:
    if row is None:
        return False
    if kind == "vitals":
        hour = _vitals_hour(row)
        return _is_abnormal_vital_flag(hour["flags"].get(flag_key, "unknown"))
    hour = _labs_hour(row)
    return _is_abnormal_lab_flag(hour["flags"].get(flag_key, "not_drawn"))


def diagnose_patient(conn, patient_id: str, first_watch_hour: int) -> dict:
    records = conn.execute(
        "SELECT * FROM hourly_records WHERE patient_id = ? ORDER BY icu_hour",
        (patient_id,),
    ).fetchall()
    rows_by_hour = {r["icu_hour"]: r for r in records}
    max_hour = max(rows_by_hour) if rows_by_hour else first_watch_hour

    vitals_window, labs_window, _, _ = _windows_at(rows_by_hour, first_watch_hour)
    flags = _dedupe_flags(
        _collect_abnormal_flags(vitals_window, "vitals")
        + _collect_abnormal_flags(labs_window, "labs")
    )

    before_row = rows_by_hour.get(first_watch_hour - 1)
    after_row = rows_by_hour.get(first_watch_hour + 1)
    persisted_before = any(
        _flag_abnormal_on_hour(before_row, item["flag_key"], item["kind"])
        for item in flags
    ) if flags else False
    persisted_after = any(
        _flag_abnormal_on_hour(after_row, item["flag_key"], item["kind"])
        for item in flags
    ) if flags else False

    later_escalated = False
    for h in range(first_watch_hour + 1, max_hour + 1):
        if _committee_severity_at(rows_by_hour, h) >= 2:
            later_escalated = True
            break

    primary = None
    with_mag = [f for f in flags if f["magnitude"] is not None]
    if with_mag:
        primary = max(with_mag, key=lambda f: f["magnitude"])
    elif flags:
        primary = flags[0]

    signal = "; ".join(
        f"{f['kind']} {f['flag_key']}:{f['status']}" for f in flags
    ) or "(no abnormal flags in windows)"

    return {
        "patient_id": patient_id,
        "first_watch_hour": first_watch_hour,
        "trigger_signal": signal,
        "trigger_value": None if primary is None else primary["value"],
        "threshold": None if primary is None else primary["threshold"],
        "magnitude_past_threshold": None if primary is None else primary["magnitude"],
        "persisted_before": persisted_before,
        "persisted_after": persisted_after,
        "later_escalated": later_escalated,
        "has_vitals": any(f["kind"] == "vitals" for f in flags),
        "has_labs": any(f["kind"] == "labs" for f in flags),
        "isolated_blip": (not persisted_before) and (not persisted_after),
        "n_flags": len(flags),
    }


def _fmt(value, digits=2) -> str:
    if value is None:
        return ""
    if isinstance(value, bool):
        return "Y" if value else "N"
    if isinstance(value, float):
        return f"{value:.{digits}f}"
    return str(value)


def main() -> None:
    if not OUT_CSV.exists():
        raise FileNotFoundError(f"{OUT_CSV} not found. Run evaluate.py first.")

    fps = load_watch_false_positives(OUT_CSV)
    random.seed(SEED)
    sample = fps if len(fps) <= SAMPLE_SIZE else random.sample(fps, SAMPLE_SIZE)
    sample = sorted(sample, key=lambda r: r["patient_id"])

    conn = _get_conn()
    diagnoses = []
    for row in sample:
        diagnoses.append(
            diagnose_patient(conn, row["patient_id"], row["first_watch_hour"])
        )
    conn.close()

    print(f"WATCH+ false positives in eval_results.csv: {len(fps)}")
    print(f"Random sample (seed={SEED}): {len(diagnoses)}")
    print()
    print(
        f"{'patient_id':<10} {'trigger_value':>13} {'threshold':>10} "
        f"{'magnitude':>10} {'before':>7} {'after':>7} {'escalated':>10}  trigger_signal"
    )
    print("-" * 120)
    for d in diagnoses:
        print(
            f"{d['patient_id']:<10} "
            f"{_fmt(d['trigger_value']):>13} "
            f"{_fmt(d['threshold']):>10} "
            f"{_fmt(d['magnitude_past_threshold']):>10} "
            f"{_fmt(d['persisted_before']):>7} "
            f"{_fmt(d['persisted_after']):>7} "
            f"{_fmt(d['later_escalated']):>10}  "
            f"{d['trigger_signal']}"
        )

    n = len(diagnoses)
    isolated = sum(1 for d in diagnoses if d["isolated_blip"])
    vitals_only = sum(1 for d in diagnoses if d["has_vitals"] and not d["has_labs"])
    labs_only = sum(1 for d in diagnoses if d["has_labs"] and not d["has_vitals"])
    both = sum(1 for d in diagnoses if d["has_vitals"] and d["has_labs"])
    neither = sum(1 for d in diagnoses if not d["has_vitals"] and not d["has_labs"])
    escalated = sum(1 for d in diagnoses if d["later_escalated"])
    mags = [d["magnitude_past_threshold"] for d in diagnoses if d["magnitude_past_threshold"] is not None]

    print()
    print("=== Summary (n={}) ===".format(n))
    print(f"Isolated single-hour blip (not persisted_before AND not persisted_after): "
          f"{isolated}/{n} = {isolated / n:.3f}")
    print(f"Vitals-only: {vitals_only}/{n} = {vitals_only / n:.3f}")
    print(f"Labs-only:   {labs_only}/{n} = {labs_only / n:.3f}")
    print(f"Both:        {both}/{n} = {both / n:.3f}")
    if neither:
        print(f"Neither (no abnormal flags in windows): {neither}/{n} = {neither / n:.3f}")
    if mags:
        print(f"Magnitude past threshold (primary/largest flag per patient, n={len(mags)}):")
        print(f"  mean:   {statistics.mean(mags):.2f}")
        print(f"  median: {statistics.median(mags):.2f}")
    else:
        print("Magnitude past threshold: n/a")
    print(f"Later escalated to DETERIORATING+: {escalated}/{n} = {escalated / n:.3f}")


if __name__ == "__main__":
    main()
