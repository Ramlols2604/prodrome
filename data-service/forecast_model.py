"""6-hour pre-onset sepsis forecast: patient-level train/val/test logistic models.

Fits class_weight='balanced' logistic regression. Evaluates on the held-out
test patients only (validation unused in this pass). Compares full feature
set vs vitals+labs severity only.
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    average_precision_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

DATASET_CSV = Path(__file__).resolve().parent / "forecast_dataset.csv"

FULL_FEATURES = [
    "vitals_severity",
    "labs_severity",
    "dissent_score",
    "trajectory_severity",
    "age",
    "gender",
    "hours_into_encounter",
]
BASELINE_FEATURES = ["vitals_severity", "labs_severity"]
TARGET = "forecast_label"
THRESHOLDS = (0.10, 0.20, 0.30)
CAL_BUCKETS = (
    (0.00, 0.20, "0-20%"),
    (0.20, 0.40, "20-40%"),
    (0.40, 0.60, "40-60%"),
    (0.60, 0.80, "60-80%"),
    (0.80, 1.00, "80-100%"),
)


def _lr_pipeline() -> Pipeline:
    return Pipeline(
        [
            ("scaler", StandardScaler()),
            (
                "lr",
                LogisticRegression(
                    class_weight="balanced",
                    solver="lbfgs",
                    max_iter=1000,
                    random_state=42,
                ),
            ),
        ]
    )


def _patient_splits(df: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    patient_ids = df["patient_id"].drop_duplicates().tolist()
    train_ids, temp_ids = train_test_split(
        patient_ids, test_size=0.30, random_state=42, shuffle=True,
    )
    val_ids, test_ids = train_test_split(
        temp_ids, test_size=0.50, random_state=42, shuffle=True,
    )
    train_ids, val_ids, test_ids = set(train_ids), set(val_ids), set(test_ids)

    assert train_ids.isdisjoint(val_ids), "train/val patient overlap"
    assert train_ids.isdisjoint(test_ids), "train/test patient overlap"
    assert val_ids.isdisjoint(test_ids), "val/test patient overlap"

    train = df[df["patient_id"].isin(train_ids)].copy()
    val = df[df["patient_id"].isin(val_ids)].copy()
    test = df[df["patient_id"].isin(test_ids)].copy()

    seen = train["patient_id"].isin(val["patient_id"]) | train["patient_id"].isin(
        test["patient_id"]
    )
    assert not seen.any()
    assert not val["patient_id"].isin(test["patient_id"]).any()
    return train, val, test


def _fit_predict(
    train: pd.DataFrame, test: pd.DataFrame, feature_cols: list[str],
) -> np.ndarray:
    pipe = _lr_pipeline()
    pipe.fit(train[feature_cols], train[TARGET].astype(int))
    return pipe.predict_proba(test[feature_cols])[:, 1]


def _calibration_table(y_true: np.ndarray, y_prob: np.ndarray) -> list[dict]:
    rows = []
    for lo, hi, name in CAL_BUCKETS:
        if hi < 1.0:
            mask = (y_prob >= lo) & (y_prob < hi)
        else:
            mask = (y_prob >= lo) & (y_prob <= hi)
        n = int(mask.sum())
        mean_pred = float(y_prob[mask].mean()) if n else float("nan")
        observed = float(y_true[mask].mean()) if n else float("nan")
        rows.append(
            {
                "bucket": name,
                "n": n,
                "mean_pred": mean_pred,
                "observed": observed,
            }
        )
    return rows


def _threshold_metrics(y_true: np.ndarray, y_prob: np.ndarray) -> list[dict]:
    rows = []
    for thr in THRESHOLDS:
        y_hat = (y_prob >= thr).astype(int)
        rows.append(
            {
                "threshold": thr,
                "precision": float(precision_score(y_true, y_hat, zero_division=0)),
                "recall": float(recall_score(y_true, y_hat, zero_division=0)),
            }
        )
    return rows


def _fmt_pct(x: float | None, digits: int = 1) -> str:
    if x is None or (isinstance(x, float) and np.isnan(x)):
        return "n/a"
    return f"{100.0 * x:.{digits}f}%"


def _fmt_f(x: float | None, digits: int = 3) -> str:
    if x is None or (isinstance(x, float) and np.isnan(x)):
        return "n/a"
    return f"{x:.{digits}f}"


def main() -> None:
    if not DATASET_CSV.exists():
        raise FileNotFoundError(
            f"{DATASET_CSV} not found. Run build_forecast_dataset.py first."
        )

    df = pd.read_csv(DATASET_CSV)
    y_all = df[TARGET].astype(int)
    print("=== Forecast model (patient-level split) ===")
    print(
        f"Loaded {DATASET_CSV.name}: {len(df)} rows, "
        f"{df['patient_id'].nunique()} patients, "
        f"positives={int(y_all.sum())} ({100.0 * y_all.mean():.1f}%)"
    )
    print()

    train, val, test = _patient_splits(df)
    print("Split                    patients       rows    pos_rate")
    print("-" * 58)
    for name, part in (("train", train), ("validation", val), ("test", test)):
        n_pos = int(part[TARGET].sum())
        print(
            f"{name:<23} {part['patient_id'].nunique():>8}  "
            f"{len(part):>10}   {_fmt_pct(part[TARGET].mean())}  "
            f"({n_pos}/{len(part)})"
        )
    print()
    print("Overlap check: PASS (asserted — no patient_id in more than one split)")
    print("Fit on train only; validation unused this pass; metrics on test.")
    print()

    y_test = test[TARGET].to_numpy(dtype=int)
    models = [
        ("Full (sev+dissent+traj+demo)", FULL_FEATURES),
        ("Severity only (vitals+labs)", BASELINE_FEATURES),
    ]
    results = []
    for name, cols in models:
        proba = _fit_predict(train, test, cols)
        results.append(
            {
                "name": name,
                "auroc": float(roc_auc_score(y_test, proba)),
                "auprc": float(average_precision_score(y_test, proba)),
                "calibration": _calibration_table(y_test, proba),
                "thresholds": _threshold_metrics(y_test, proba),
            }
        )

    print("Model                              AUROC    AUPRC")
    print("-" * 50)
    for r in results:
        print(f"{r['name']:<33} {_fmt_f(r['auroc'])}   {_fmt_f(r['auprc'])}")
    print()
    print(
        f"AUPRC is the headline metric here (prevalence on test = "
        f"{_fmt_pct(y_test.mean())}; random AUPRC ≈ prevalence)."
    )
    print()

    for r in results:
        print(f"--- Calibration (test): {r['name']} ---")
        print(f"{'Bucket':<10} {'n':>8}  {'mean_pred':>10}  {'observed+':>10}")
        print("-" * 44)
        for row in r["calibration"]:
            print(
                f"{row['bucket']:<10} {row['n']:>8}  "
                f"{_fmt_pct(row['mean_pred'], 1):>10}  "
                f"{_fmt_pct(row['observed'], 1):>10}"
            )
        print()

    print("Precision / Recall at probability thresholds (test)")
    print(f"{'Model':<33} {'thr':>5}  {'Prec':>8}  {'Rec':>8}")
    print("-" * 60)
    for r in results:
        for row in r["thresholds"]:
            print(
                f"{r['name']:<33} {row['threshold']:>5.2f}  "
                f"{_fmt_pct(row['precision']):>8}  "
                f"{_fmt_pct(row['recall']):>8}"
            )
        print()


if __name__ == "__main__":
    main()
