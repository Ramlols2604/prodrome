"""Read-only diagnostic: septic TPs lost when persistence filtering was applied.

Compares eval_results.csv vs eval_results_persistent.csv. Does not modify
verdict or evaluation logic.
"""

from __future__ import annotations

import csv
import statistics

from diagnose_watch_fp import (
    _collect_abnormal_flags,
    _dedupe_flags,
    _is_non_septic,
    _labs_hour,
    _parse_optional_int,
    _vitals_hour,
    _windows_at,
)
from evaluate import OUT_CSV, OUT_CSV_PERSISTENT, _get_conn
from main import _hour_had_any_lab, _is_abnormal_lab_flag, _is_abnormal_vital_flag


def _is_septic(raw) -> bool:
    return not _is_non_septic(raw) and str(raw).strip() != ""


def _load_csv(path) -> dict[str, dict]:
    with path.open(newline="") as f:
        rows = list(csv.DictReader(f))
    out = {}
    for row in rows:
        out[row["patient_id"]] = {
            "patient_id": row["patient_id"],
            "is_septic": _is_septic(row.get("is_septic")),
            "sepsis_onset_hour": _parse_optional_int(row.get("sepsis_onset_hour")),
            "first_watch_hour": _parse_optional_int(row.get("first_watch_hour")),
            "first_deteriorating_hour": _parse_optional_int(
                row.get("first_deteriorating_hour")
            ),
            "first_critical_hour": _parse_optional_int(row.get("first_critical_hour")),
        }
    return out


def _lost_tps(baseline: dict, persistent: dict) -> list[dict]:
    lost = []
    for pid, b in baseline.items():
        if not b["is_septic"] or b["first_watch_hour"] is None:
            continue
        p = persistent.get(pid)
        if p is None:
            continue
        pw = p["first_watch_hour"]
        if pw is None or pw > b["first_watch_hour"]:
            lost.append({
                "patient_id": pid,
                "sepsis_onset_hour": b["sepsis_onset_hour"],
                "baseline_first_watch_hour": b["first_watch_hour"],
                "persistent_first_watch_hour": pw,
                "baseline_deteriorating": b["first_deteriorating_hour"],
                "baseline_critical": b["first_critical_hour"],
                "persistent_deteriorating": p["first_deteriorating_hour"],
                "persistent_critical": p["first_critical_hour"],
            })
    return sorted(lost, key=lambda r: r["patient_id"])


def _flag_abnormal_at(rows_by_hour, hour: int, flag_key: str, kind: str) -> bool:
    row = rows_by_hour.get(hour)
    if row is None:
        return False
    if kind == "vitals":
        flags = _vitals_hour(row)["flags"]
        return _is_abnormal_vital_flag(flags.get(flag_key, "unknown"))
    flags = _labs_hour(row)["flags"]
    return _is_abnormal_lab_flag(flags.get(flag_key, "not_drawn"))


def _consecutive_ending_at(rows_by_hour, h: int, flag_key: str, kind: str) -> int:
    count = 0
    t = h
    while t in rows_by_hour or (kind == "labs" and t > 0):
        if t not in rows_by_hour:
            t -= 1
            continue
        if kind == "labs":
            lab_hour = _labs_hour(rows_by_hour[t])
            if not _hour_had_any_lab(lab_hour):
                t -= 1
                continue
        if not _flag_abnormal_at(rows_by_hour, t, flag_key, kind):
            break
        count += 1
        t -= 1
    return count


def _trailing_hits(window: list[dict], flag_key: str, kind: str, trailing: int = 3):
    if kind == "labs":
        series = [hour for hour in window if _hour_had_any_lab(hour)]
        is_abn = lambda hour: _is_abnormal_lab_flag(  # noqa: E731
            hour.get("flags", {}).get(flag_key, "not_drawn")
        )
    else:
        series = list(window)
        is_abn = lambda hour: _is_abnormal_vital_flag(  # noqa: E731
            hour.get("flags", {}).get(flag_key, "unknown")
        )
    recent = series[-trailing:] if len(series) >= trailing else series
    hits = sum(1 for hour in recent if is_abn(hour))
    window_hits = sum(1 for hour in series if is_abn(hour))
    required = 2 if len(recent) >= trailing else len(recent)
    return hits, len(recent), required, window_hits


def _classify_flag(consecutive: int, trailing_hits: int, required: int, window_hits: int) -> str:
    if required > 0 and trailing_hits >= required:
        return "would_persist"
    if consecutive <= 1 and window_hits <= 1:
        return "isolated_blip"
    if consecutive >= 3 or window_hits >= 3:
        return "real_signal"
    return "borderline"


def _patient_class(flag_classes: list[str]) -> str:
    if not flag_classes:
        return "no_flags"
    if "real_signal" in flag_classes:
        return "real_signal"
    if "borderline" in flag_classes:
        return "borderline"
    if "would_persist" in flag_classes:
        return "would_persist"
    return "isolated_blip"


def diagnose_one(conn, rec: dict) -> dict:
    pid = rec["patient_id"]
    h = rec["baseline_first_watch_hour"]
    records = conn.execute(
        "SELECT * FROM hourly_records WHERE patient_id = ? ORDER BY icu_hour",
        (pid,),
    ).fetchall()
    rows_by_hour = {r["icu_hour"]: r for r in records}
    vitals_window, labs_window, _, _ = _windows_at(rows_by_hour, h)
    flags = _dedupe_flags(
        _collect_abnormal_flags(vitals_window, "vitals")
        + _collect_abnormal_flags(labs_window, "labs")
    )

    flag_details = []
    flag_classes = []
    for item in flags:
        consec = _consecutive_ending_at(
            rows_by_hour, h, item["flag_key"], item["kind"]
        )
        window = vitals_window if item["kind"] == "vitals" else labs_window
        trail_hits, trail_n, required, window_hits = _trailing_hits(
            window, item["flag_key"], item["kind"]
        )
        cls = _classify_flag(consec, trail_hits, required, window_hits)
        flag_classes.append(cls)
        mag = item["magnitude"]
        mag_s = f"{mag:.2f}" if mag is not None else "?"
        flag_details.append(
            f"{item['kind']} {item['flag_key']}:{item['status']} "
            f"(consec={consec}, trail={trail_hits}/{trail_n} need {required}, "
            f"win={window_hits}, mag={mag_s}, {cls})"
        )

    pw = rec["persistent_first_watch_hour"]
    onset = rec["sepsis_onset_hour"]
    if pw is None:
        persistent_watch_s = "NEVER"
        lead_time_lost = None if onset is None else onset - h
    else:
        persistent_watch_s = str(pw)
        lead_time_lost = pw - h

    later_either = any(
        rec[k] is not None
        for k in (
            "baseline_deteriorating",
            "baseline_critical",
            "persistent_deteriorating",
            "persistent_critical",
        )
    )
    caught_under_persistence = any(
        rec[k] is not None
        for k in (
            "persistent_first_watch_hour",
            "persistent_deteriorating",
            "persistent_critical",
        )
    )
    mags = [f["magnitude"] for f in flags if f["magnitude"] is not None]
    primary_mag = max(mags) if mags else None

    return {
        "patient_id": pid,
        "baseline_first_watch_hour": h,
        "persistent_first_watch_hour": persistent_watch_s,
        "lead_time_lost": lead_time_lost,
        "trigger_flags": "; ".join(flag_details) or "(no abnormal vitals/labs flags)",
        "blip_class": _patient_class(flag_classes),
        "magnitude": primary_mag,
        "later_escalated_either": later_either,
        "caught_under_persistence": caught_under_persistence,
        "onset": onset,
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
    if not OUT_CSV.exists() or not OUT_CSV_PERSISTENT.exists():
        raise FileNotFoundError(
            "Need eval_results.csv and eval_results_persistent.csv. Run evaluate.py first."
        )

    baseline = _load_csv(OUT_CSV)
    persistent = _load_csv(OUT_CSV_PERSISTENT)
    lost = _lost_tps(baseline, persistent)

    conn = _get_conn()
    rows = [diagnose_one(conn, rec) for rec in lost]
    conn.close()

    never = sum(1 for r in rows if r["persistent_first_watch_hour"] == "NEVER")
    delayed = len(rows) - never
    print(
        f"Septic patients with baseline WATCH+ but persistence null/later: "
        f"{len(rows)} (NEVER={never}, delayed={delayed})"
    )
    print()
    print(
        f"{'patient_id':<10} {'base_w':>6} {'pers_w':>6} {'lost_lt':>8} "
        f"{'mag':>7} {'class':<14} {'esc':>3} {'caughtP':>7}  flags"
    )
    print("-" * 140)
    for r in rows:
        print(
            f"{r['patient_id']:<10} "
            f"{r['baseline_first_watch_hour']:>6} "
            f"{str(r['persistent_first_watch_hour']):>6} "
            f"{_fmt(r['lead_time_lost']):>8} "
            f"{_fmt(r['magnitude']):>7} "
            f"{r['blip_class']:<14} "
            f"{_fmt(r['later_escalated_either']):>3} "
            f"{_fmt(r['caught_under_persistence']):>7}  "
            f"{r['trigger_flags']}"
        )

    n = len(rows) or 1
    isolated = sum(1 for r in rows if r["blip_class"] == "isolated_blip")
    borderline = sum(1 for r in rows if r["blip_class"] == "borderline")
    real = sum(1 for r in rows if r["blip_class"] == "real_signal")
    would = sum(1 for r in rows if r["blip_class"] == "would_persist")
    noflags = sum(1 for r in rows if r["blip_class"] == "no_flags")
    lts = [r["lead_time_lost"] for r in rows if r["lead_time_lost"] is not None]
    caught = sum(1 for r in rows if r["caught_under_persistence"])
    missed = len(rows) - caught
    never_rows = [r for r in rows if r["persistent_first_watch_hour"] == "NEVER"]
    never_caught = sum(1 for r in never_rows if r["caught_under_persistence"])
    never_missed = len(never_rows) - never_caught

    print()
    print(f"=== Summary (n={len(rows)}) ===")
    print(f"Isolated 1-hour blips:     {isolated}/{len(rows)} = {isolated / n:.3f}")
    print(f"Borderline (e.g. 2h, missed exact 2-of-3 window): "
          f"{borderline}/{len(rows)} = {borderline / n:.3f}")
    print(f"Real/meaningful early signal suppressed: "
          f"{real}/{len(rows)} = {real / n:.3f}")
    if would:
        print(f"Would-have-persisted (unexpected): {would}/{len(rows)}")
    if noflags:
        print(f"No vitals/labs flags (likely historical-only WATCH): {noflags}/{len(rows)}")
    if lts:
        print(f"Lead time lost (hours): mean={statistics.mean(lts):.2f}  "
              f"median={statistics.median(lts):.2f}")
        print("  NEVER cases: sepsis_onset - baseline_watch; "
              "delayed cases: persistent_watch - baseline_watch")
        print("  (positive = lost early warning before onset)")
    print(f"Eventually caught under persistence (WATCH+/DET+/CRIT at any hour): "
          f"{caught}/{len(rows)} = {caught / n:.3f}")
    print(f"Missed completely under persistence: "
          f"{missed}/{len(rows)} = {missed / n:.3f}")
    print(f"  among NEVER-WATCH patients: still caught via DET+/CRIT = "
          f"{never_caught}/{len(never_rows)}; missed entirely = {never_missed}/{len(never_rows)}")


if __name__ == "__main__":
    main()
