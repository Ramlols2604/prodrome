"""Landmark-based 6-hour sepsis forecast table with temporal signal features.

Scans physionet_data/training/. Features at hour t use only observations
at or before t (LOCF for sparse labs). Hour indexing matches
data_loader/evaluate: 0-based icu_hour, MIN_HOUR=6.

Trailing 4-hour window = hours t-3..t inclusive (evaluate-style
hours_back=4). A hard assertion halts if any emitted row has
hour >= that patient's sepsis onset.
"""

from __future__ import annotations

import csv
import math
import random
import time
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent
SRC_DIR = ROOT / "physionet_data" / "training"
OUT_CSV = ROOT / "temporal_forecast_dataset.csv"

MIN_HOUR = 6
HORIZON = 6
MAX_ROWS_PER_PATIENT = 3
SEED = 42
WINDOW_HOURS = 4  # trailing window length ending at t

# (PSV column, feature prefix)
SIGNALS = (
    ("HR", "hr"),
    ("MAP", "map"),
    ("SBP", "sbp"),
    ("Resp", "resp"),
    ("Temp", "temp"),
    ("O2Sat", "o2sat"),
    ("Lactate", "lactate"),
    ("WBC", "wbc"),
    ("Creatinine", "creatinine"),
    ("Platelets", "platelets"),
)

SIGNAL_SUFFIXES = (
    "current",
    "lag_2h",
    "lag_4h",
    "lag_6h",
    "delta_2h",
    "delta_4h",
    "slope_4h",
    "rolling_mean_4h",
    "rolling_std_4h",
    "rolling_min_4h",
    "rolling_max_4h",
    "missing_4h",
)

FEATURE_COLS = [
    f"{prefix}_{suffix}"
    for _, prefix in SIGNALS
    for suffix in SIGNAL_SUFFIXES
] + ["age", "gender", "hours_into_encounter"]

ID_COLS = ["patient_id", "hour", "forecast_label"]
FIELDNAMES = ID_COLS + FEATURE_COLS


def _parse_float(raw: str | None) -> float:
    if raw is None:
        return math.nan
    text = raw.strip()
    if not text or text.lower() == "nan":
        return math.nan
    try:
        return float(text)
    except ValueError:
        return math.nan


def _parse_sepsis(raw: str | None) -> int:
    value = _parse_float(raw)
    if math.isnan(value):
        return 0
    return 1 if value >= 1 else 0


def _finite(value: float | None) -> float | None:
    if value is None or (isinstance(value, float) and math.isnan(value)):
        return None
    return float(value)


def load_patient(path: Path) -> dict | None:
    """Load one PSV: sepsis labels + the 10 landmark signals as NaN arrays."""
    with path.open(newline="") as f:
        reader = csv.reader(f, delimiter="|")
        try:
            header = next(reader)
        except StopIteration:
            return None
        col = {name: i for i, name in enumerate(header)}
        if "SepsisLabel" not in col:
            raise ValueError(f"{path.name} is missing a SepsisLabel column")
        missing = [psv for psv, _ in SIGNALS if psv not in col]
        if missing:
            raise ValueError(f"{path.name} is missing signal columns: {missing}")

        sepsis: list[int] = []
        age = math.nan
        gender = math.nan
        series = {prefix: [] for _, prefix in SIGNALS}
        age_i = col.get("Age")
        gender_i = col.get("Gender")
        sepsis_i = col["SepsisLabel"]
        sig_i = {prefix: col[psv] for psv, prefix in SIGNALS}

        for row in reader:
            sepsis.append(_parse_sepsis(row[sepsis_i] if sepsis_i < len(row) else None))
            if math.isnan(age) and age_i is not None and age_i < len(row):
                age = _parse_float(row[age_i])
            if math.isnan(gender) and gender_i is not None and gender_i < len(row):
                gender = _parse_float(row[gender_i])
            for prefix, idx in sig_i.items():
                series[prefix].append(
                    _parse_float(row[idx] if idx < len(row) else None)
                )

    n = len(sepsis)
    if n == 0:
        return None
    return {
        "patient_id": path.stem,
        "n": n,
        "sepsis": np.asarray(sepsis, dtype=np.int8),
        "age": None if math.isnan(age) else float(age),
        "gender": None if math.isnan(gender) else int(gender),
        "series": {
            prefix: np.asarray(vals, dtype=np.float64) for prefix, vals in series.items()
        },
    }


def _onset_hour(sepsis: np.ndarray) -> int | None:
    hits = np.flatnonzero(sepsis == 1)
    if hits.size == 0:
        return None
    return int(hits[0])


def _locf(values: np.ndarray) -> np.ndarray:
    out = np.empty_like(values, dtype=np.float64)
    last = math.nan
    for i, v in enumerate(values):
        if not math.isnan(v):
            last = float(v)
        out[i] = last
    return out


def _eligible_hours(sepsis: np.ndarray) -> list[tuple[int, int]]:
    n = int(sepsis.size)
    max_hour = n - 1
    onset = _onset_hour(sepsis)
    last_t = max_hour - HORIZON
    eligible: list[tuple[int, int]] = []
    for t in range(MIN_HOUR, last_t + 1):
        if onset is not None and t >= onset:
            continue
        future = sepsis[t + 1 : t + HORIZON + 1]
        forecast_label = 1 if np.any(future == 1) else 0
        eligible.append((t, forecast_label))
    return eligible


def _slope(hours: np.ndarray, values: np.ndarray) -> float | None:
    if hours.size < 2:
        return None
    x = hours.astype(np.float64)
    y = values.astype(np.float64)
    x_mean = float(x.mean())
    y_mean = float(y.mean())
    var_x = float(np.sum((x - x_mean) ** 2))
    if var_x == 0.0:
        return None
    return float(np.sum((x - x_mean) * (y - y_mean)) / var_x)


def _window_obs(values: np.ndarray, t: int) -> tuple[np.ndarray, np.ndarray]:
    """Non-null (hour, value) pairs in trailing 4h window ending at t."""
    start = t - WINDOW_HOURS + 1
    if start < 0:
        start = 0
    hours = np.arange(start, t + 1)
    window = values[start : t + 1]
    mask = ~np.isnan(window)
    return hours[mask], window[mask]


def _locf_at(locf: np.ndarray, hour: int) -> float | None:
    if hour < 0:
        return None
    return _finite(float(locf[hour]))


def features_at(series: dict[str, np.ndarray], locf: dict[str, np.ndarray], t: int) -> dict:
    feats: dict = {}
    for _, prefix in SIGNALS:
        vals = series[prefix]
        locf_s = locf[prefix]
        current = _locf_at(locf_s, t)
        lag_2h = _locf_at(locf_s, t - 2)
        lag_4h = _locf_at(locf_s, t - 4)
        lag_6h = _locf_at(locf_s, t - 6)
        delta_2h = (
            current - lag_2h if current is not None and lag_2h is not None else None
        )
        delta_4h = (
            current - lag_4h if current is not None and lag_4h is not None else None
        )
        obs_hours, obs_vals = _window_obs(vals, t)
        n_obs = int(obs_vals.size)
        feats[f"{prefix}_current"] = current
        feats[f"{prefix}_lag_2h"] = lag_2h
        feats[f"{prefix}_lag_4h"] = lag_4h
        feats[f"{prefix}_lag_6h"] = lag_6h
        feats[f"{prefix}_delta_2h"] = delta_2h
        feats[f"{prefix}_delta_4h"] = delta_4h
        feats[f"{prefix}_slope_4h"] = _slope(obs_hours, obs_vals)
        feats[f"{prefix}_rolling_mean_4h"] = (
            float(obs_vals.mean()) if n_obs else None
        )
        feats[f"{prefix}_rolling_std_4h"] = (
            float(obs_vals.std(ddof=1)) if n_obs >= 2 else None
        )
        feats[f"{prefix}_rolling_min_4h"] = (
            float(obs_vals.min()) if n_obs else None
        )
        feats[f"{prefix}_rolling_max_4h"] = (
            float(obs_vals.max()) if n_obs else None
        )
        feats[f"{prefix}_missing_4h"] = 0 if n_obs else 1
    return feats


def _csv_value(value):
    if value is None:
        return ""
    if isinstance(value, float) and math.isnan(value):
        return ""
    return value


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
    n_after = 0
    n_pos = 0

    with OUT_CSV.open("w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=FIELDNAMES)
        writer.writeheader()

        for i, path in enumerate(psv_files, start=1):
            patient = load_patient(path)
            n_scanned += 1
            if patient is None:
                continue
            sepsis = patient["sepsis"]
            onset = _onset_hour(sepsis)
            eligible = _eligible_hours(sepsis)
            n_before += len(eligible)
            if len(eligible) > MAX_ROWS_PER_PATIENT:
                sampled = random.sample(eligible, MAX_ROWS_PER_PATIENT)
            else:
                sampled = list(eligible)
            sampled.sort(key=lambda x: x[0])

            locf = {prefix: _locf(vals) for prefix, vals in patient["series"].items()}
            for t, forecast_label in sampled:
                assert onset is None or t < onset, (
                    f"Temporal leakage: {patient['patient_id']} hour={t} "
                    f">= onset={onset}"
                )
                row = {
                    "patient_id": patient["patient_id"],
                    "hour": t,
                    "forecast_label": forecast_label,
                    "age": patient["age"],
                    "gender": patient["gender"],
                    "hours_into_encounter": t,
                }
                row.update(features_at(patient["series"], locf, t))
                writer.writerow({k: _csv_value(row.get(k)) for k in FIELDNAMES})
                n_after += 1
                n_pos += int(forecast_label)

            if i % 1000 == 0 or i == len(psv_files):
                elapsed = time.time() - started
                print(
                    f"  processed {i}/{len(psv_files)}  "
                    f"eligible={n_before} sampled={n_after}  "
                    f"({elapsed:.0f}s)",
                    flush=True,
                )

    pos_rate = (100.0 * n_pos / n_after) if n_after else 0.0
    elapsed = time.time() - started

    print()
    print("=== Temporal forecast dataset ===")
    print(f"Patients scanned:                         {n_scanned}")
    print(f"Eligible (patient, t) pairs before sample: {n_before}")
    print(f"After sampling (<=3 per patient):         {n_after}")
    print(
        f"Positive label rate (forecast_label==1):  "
        f"{pos_rate:.1f}%  ({n_pos}/{n_after})"
    )
    print("Onset leak assertion:                      PASS (script did not halt)")
    print(f"Feature columns ({len(FEATURE_COLS)}):")
    for name in FEATURE_COLS:
        print(f"  {name}")
    print(f"Wrote {OUT_CSV} ({n_after} rows, {len(FIELDNAMES)} columns) in {elapsed:.0f}s")


if __name__ == "__main__":
    main()
