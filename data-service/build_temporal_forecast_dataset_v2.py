"""Rebuild temporal forecast table: sampled train/val, full test landmarks.

Part A prints diagnostics on temporal_forecast_dataset.csv (no rewrite).
Part B writes temporal_forecast_dataset_v2.csv with split + time_to_onset.
"""

from __future__ import annotations

import csv
import random
import time
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split

from build_temporal_forecast_dataset import (
    FEATURE_COLS,
    HORIZON,
    ID_COLS,
    MAX_ROWS_PER_PATIENT,
    SEED,
    SRC_DIR,
    _csv_value,
    _eligible_hours,
    _locf,
    _onset_hour,
    _parse_sepsis,
    features_at,
    load_patient,
)

V1_CSV = Path(__file__).resolve().parent / "temporal_forecast_dataset.csv"
OUT_CSV = Path(__file__).resolve().parent / "temporal_forecast_dataset_v2.csv"
FIELDNAMES = ID_COLS + ["split", "time_to_onset"] + FEATURE_COLS

HOUR_BUCKETS = (
    ("0-6h", lambda h: h <= 6),
    ("6-12h", lambda h: 6 < h <= 12),
    ("12-24h", lambda h: 12 < h <= 24),
    (">24h", lambda h: h > 24),
)


def _onset_from_psv(path: Path) -> int | None:
    with path.open(newline="") as f:
        reader = csv.DictReader(f, delimiter="|")
        if not reader.fieldnames or "SepsisLabel" not in reader.fieldnames:
            raise ValueError(f"{path.name} is missing a SepsisLabel column")
        for i, row in enumerate(reader):
            if _parse_sepsis(row.get("SepsisLabel")) == 1:
                return i
    return None


def print_part_a() -> None:
    if not V1_CSV.exists():
        raise FileNotFoundError(
            f"{V1_CSV} not found. Run build_temporal_forecast_dataset.py first."
        )
    df = pd.read_csv(V1_CSV)
    pos = df[df["forecast_label"] == 1].copy()
    neg = df[df["forecast_label"] == 0]
    pos_ids = sorted(pos["patient_id"].unique())

    onset_by_pid: dict[str, int] = {}
    missing = []
    for pid in pos_ids:
        path = SRC_DIR / f"{pid}.psv"
        if not path.exists():
            missing.append(pid)
            continue
        onset = _onset_from_psv(path)
        if onset is None:
            missing.append(pid)
        else:
            onset_by_pid[pid] = onset

    tto = []
    for _, row in pos.iterrows():
        onset = onset_by_pid.get(row["patient_id"])
        if onset is None:
            continue
        tto.append(onset - int(row["hour"]))
    tto_arr = np.asarray(tto, dtype=float)

    print("=== Part A: temporal_forecast_dataset.csv diagnostics ===")
    print(
        f"Rows: {len(df)}  positives: {len(pos)}  "
        f"unique positive patients: {len(pos_ids)}"
    )
    if missing:
        print(f"WARNING: onset missing for {len(missing)} positive patients")
    print()
    print("Time-to-onset for positive rows (onset_hour - landmark hour)")
    if tto_arr.size:
        q25, q50, q75 = np.percentile(tto_arr, [25, 50, 75])
        print(f"  n={tto_arr.size}  min={tto_arr.min():.0f}  max={tto_arr.max():.0f}")
        print(f"  median={q50:.1f}h   p25={q25:.1f}h   p75={q75:.1f}h")
    else:
        print("  n/a (no positive onsets found)")
    print()
    print("hours_into_encounter distribution (landmark hour)")
    print(f"{'bucket':<10} {'n_pos':>8} {'pct_pos':>9} {'n_neg':>8} {'pct_neg':>9}")
    print("-" * 48)
    n_pos, n_neg = len(pos), len(neg)
    for name, pred in HOUR_BUCKETS:
        np_ = int(pos["hours_into_encounter"].map(pred).sum())
        nn_ = int(neg["hours_into_encounter"].map(pred).sum())
        print(
            f"{name:<10} {np_:>8} {100.0 * np_ / n_pos if n_pos else 0:>8.1f}% "
            f"{nn_:>8} {100.0 * nn_ / n_neg if n_neg else 0:>8.1f}%"
        )
    print()


def _split_patient_ids(patient_ids: list[str]) -> tuple[set[str], set[str], set[str]]:
    train_ids, temp_ids = train_test_split(
        patient_ids, test_size=0.30, random_state=42, shuffle=True,
    )
    val_ids, test_ids = train_test_split(
        temp_ids, test_size=0.50, random_state=42, shuffle=True,
    )
    train_s, val_s, test_s = set(train_ids), set(val_ids), set(test_ids)
    assert train_s.isdisjoint(val_s)
    assert train_s.isdisjoint(test_s)
    assert val_s.isdisjoint(test_s)
    return train_s, val_s, test_s


def build_v2() -> None:
    if not SRC_DIR.exists():
        raise FileNotFoundError(
            f"{SRC_DIR} not found. Run ./download_data.sh first."
        )
    if not V1_CSV.exists():
        raise FileNotFoundError(
            f"{V1_CSV} not found. Run build_temporal_forecast_dataset.py first."
        )

    v1 = pd.read_csv(V1_CSV, usecols=["patient_id"])
    patient_ids = v1["patient_id"].drop_duplicates().tolist()
    train_ids, val_ids, test_ids = _split_patient_ids(patient_ids)
    split_of = {}
    for pid in train_ids:
        split_of[pid] = "train"
    for pid in val_ids:
        split_of[pid] = "validation"
    for pid in test_ids:
        split_of[pid] = "test"

    psv_files = sorted(SRC_DIR.glob("*.psv"))
    random.seed(SEED)
    started = time.time()
    counts = {"train": 0, "validation": 0, "test": 0}
    pos_counts = {"train": 0, "validation": 0, "test": 0}
    n_test_if_sampled = 0
    n_eligible_all = 0

    with OUT_CSV.open("w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=FIELDNAMES)
        writer.writeheader()

        for i, path in enumerate(psv_files, start=1):
            pid = path.stem
            split = split_of.get(pid)
            if split is None:
                continue
            patient = load_patient(path)
            if patient is None:
                continue
            sepsis = patient["sepsis"]
            onset = _onset_hour(sepsis)
            eligible = _eligible_hours(sepsis)
            n_eligible_all += len(eligible)

            if split == "test":
                n_test_if_sampled += min(len(eligible), MAX_ROWS_PER_PATIENT)
                chosen = list(eligible)
            elif len(eligible) > MAX_ROWS_PER_PATIENT:
                chosen = random.sample(eligible, MAX_ROWS_PER_PATIENT)
            else:
                chosen = list(eligible)
            chosen.sort(key=lambda x: x[0])

            locf = {prefix: _locf(vals) for prefix, vals in patient["series"].items()}
            for t, forecast_label in chosen:
                assert onset is None or t < onset, (
                    f"Temporal leakage: {pid} hour={t} >= onset={onset}"
                )
                time_to_onset = (onset - t) if forecast_label == 1 else None
                if forecast_label == 1:
                    assert time_to_onset is not None and 1 <= time_to_onset <= HORIZON, (
                        f"Bad time_to_onset={time_to_onset} for {pid} t={t} onset={onset}"
                    )
                row = {
                    "patient_id": pid,
                    "hour": t,
                    "forecast_label": forecast_label,
                    "split": split,
                    "time_to_onset": time_to_onset,
                    "age": patient["age"],
                    "gender": patient["gender"],
                    "hours_into_encounter": t,
                }
                row.update(features_at(patient["series"], locf, t))
                writer.writerow({k: _csv_value(row.get(k)) for k in FIELDNAMES})
                counts[split] += 1
                pos_counts[split] += int(forecast_label)

            if i % 1000 == 0 or i == len(psv_files):
                elapsed = time.time() - started
                print(
                    f"  processed {i}/{len(psv_files)}  "
                    f"train={counts['train']} val={counts['validation']} "
                    f"test={counts['test']}  ({elapsed:.0f}s)",
                    flush=True,
                )

    elapsed = time.time() - started
    n_total = sum(counts.values())
    print()
    print("=== Part B: temporal_forecast_dataset_v2.csv ===")
    print(
        f"Patients: train={len(train_ids)}  validation={len(val_ids)}  "
        f"test={len(test_ids)}  (random_state=42, same 70/15/15 as forecast_model.py)"
    )
    print(f"{'split':<12} {'patients':>10} {'rows':>10} {'positives':>10} {'pos_rate':>9}")
    print("-" * 55)
    for name, n_pat in (
        ("train", len(train_ids)),
        ("validation", len(val_ids)),
        ("test", len(test_ids)),
    ):
        n_rows = counts[name]
        n_pos = pos_counts[name]
        rate = (100.0 * n_pos / n_rows) if n_rows else 0.0
        print(f"{name:<12} {n_pat:>10} {n_rows:>10} {n_pos:>10} {rate:>8.1f}%")
    print(
        f"{'total':<12} {len(patient_ids):>10} {n_total:>10} "
        f"{sum(pos_counts.values()):>10}"
    )
    print()
    print(
        f"Test rows if still ≤3/patient: {n_test_if_sampled}  "
        f"vs full-landmark test: {counts['test']}  "
        f"({counts['test'] / n_test_if_sampled:.1f}x larger)"
        if n_test_if_sampled
        else ""
    )
    print("Onset leak assertion: PASS (script did not halt)")
    print(f"Wrote {OUT_CSV} ({n_total} rows) in {elapsed:.0f}s")


def main() -> None:
    print_part_a()
    build_v2()


if __name__ == "__main__":
    main()
