"""Calibrated 6-hour forecast models on temporal_forecast_dataset_v2.csv.

Uses the file's split column (patient-level train/val/test). Fits logistic
regression (class_weight='balanced') and LightGBM (is_unbalance=True),
calibrates both with isotonic regression on validation, evaluates on the
full-landmark test set.
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd
from lightgbm import LGBMClassifier
from sklearn.calibration import CalibratedClassifierCV
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    average_precision_score,
    brier_score_loss,
    roc_auc_score,
)
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from build_temporal_forecast_dataset import FEATURE_COLS

DATASET_CSV = Path(__file__).resolve().parent / "temporal_forecast_dataset_v2.csv"
TARGET = "forecast_label"
DEMO_FEATURES = ["hours_into_encounter", "age", "gender"]
NO_HOURS_FEATURES = [c for c in FEATURE_COLS if c != "hours_into_encounter"]
PHYSIO_FEATURES = [
    c for c in FEATURE_COLS if c not in DEMO_FEATURES
]
INTERACTION_FEATURES = [
    "map_declining_4h",
    "lactate_rising_4h",
    "hr_rising_4h",
    "resp_rising_4h",
    "deterioration_combo_count",
]
PHYSIO_INTERACTION_FEATURES = PHYSIO_FEATURES + INTERACTION_FEATURES
# Slope cutoffs (units/hour over trailing 4h). Missing slope → flag 0.
# Kept as specified: they sit near train p75–p90 (lactate >0.3 ≈ p90 of
# non-null slopes; MAP <-1 / HR >2 / Resp >1 ≈ p70–p80).
SLOPE_CUTOFFS = {
    "map_declining_4h": ("map_slope_4h", "<", -1.0),
    "lactate_rising_4h": ("lactate_slope_4h", ">", 0.3),
    "hr_rising_4h": ("hr_slope_4h", ">", 2.0),
    "resp_rising_4h": ("resp_slope_4h", ">", 1.0),
}
TOPK_FRACS = (0.01, 0.02, 0.05, 0.10)
CAL_BUCKETS = (
    (0.00, 0.20, "0-20%"),
    (0.20, 0.40, "20-40%"),
    (0.40, 0.60, "40-60%"),
    (0.60, 0.80, "60-80%"),
    (0.80, 1.00, "80-100%"),
)
LEAD_BUCKETS = (
    ("0-1h", lambda t: t <= 1),
    ("1-2h", lambda t: 1 < t <= 2),
    ("2-4h", lambda t: 2 < t <= 4),
    ("4-6h", lambda t: 4 < t <= 6),
)


def _lr_estimator() -> Pipeline:
    return Pipeline(
        [
            ("imputer", SimpleImputer(strategy="median")),
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


def _lgb_estimator() -> LGBMClassifier:
    return LGBMClassifier(
        n_estimators=200,
        max_depth=5,
        learning_rate=0.05,
        is_unbalance=True,
        random_state=42,
        verbosity=-1,
    )


def _calibrate(estimator, X_val: pd.DataFrame, y_val: np.ndarray):
    calibrated = CalibratedClassifierCV(estimator, method="isotonic", cv="prefit")
    calibrated.fit(X_val, y_val)
    return calibrated


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
        rows.append({"bucket": name, "n": n, "mean_pred": mean_pred, "observed": observed})
    return rows


def _topk_metrics(y_true: np.ndarray, y_prob: np.ndarray, frac: float) -> dict:
    n = len(y_true)
    k = max(1, int(round(n * frac)))
    top = np.argsort(-y_prob, kind="mergesort")[:k]
    tp = float(y_true[top].sum())
    n_pos = float(y_true.sum())
    return {
        "frac": frac,
        "k": k,
        "precision": tp / k,
        "recall": (tp / n_pos) if n_pos else 0.0,
    }


def _lead_time_auprc(
    y_true: np.ndarray, y_prob: np.ndarray, time_to_onset: np.ndarray,
) -> list[dict]:
    neg = y_true == 0
    rows = []
    for name, pred in LEAD_BUCKETS:
        pos_mask = np.zeros(len(y_true), dtype=bool)
        for i, (y, tto) in enumerate(zip(y_true, time_to_onset)):
            if y == 1 and not np.isnan(tto) and pred(float(tto)):
                pos_mask[i] = True
        n_pos = int(pos_mask.sum())
        if n_pos == 0:
            rows.append({"bucket": name, "n_pos": 0, "auprc": float("nan")})
            continue
        y_sub = np.concatenate([y_true[pos_mask], y_true[neg]])
        p_sub = np.concatenate([y_prob[pos_mask], y_prob[neg]])
        rows.append(
            {
                "bucket": name,
                "n_pos": n_pos,
                "auprc": float(average_precision_score(y_sub, p_sub)),
            }
        )
    return rows


def _fmt_f(x: float, digits: int = 3) -> str:
    if x is None or (isinstance(x, float) and np.isnan(x)):
        return "n/a"
    return f"{x:.{digits}f}"


def _fmt_pct(x: float, digits: int = 1) -> str:
    if x is None or (isinstance(x, float) and np.isnan(x)):
        return "n/a"
    return f"{100.0 * x:.{digits}f}%"


def _fit_lgb_calibrated(
    feature_cols: list[str],
    X_train: pd.DataFrame,
    y_train: np.ndarray,
    X_val: pd.DataFrame,
    y_val: np.ndarray,
    X_test: pd.DataFrame,
) -> np.ndarray:
    est = _lgb_estimator()
    est.fit(X_train[feature_cols], y_train)
    cal = _calibrate(est, X_val[feature_cols], y_val)
    return cal.predict_proba(X_test[feature_cols])[:, 1]


def _top5_cutoff(y_prob: np.ndarray) -> tuple[float, int]:
    """Same cutoff as the existing top-5% ranking: k-th largest score."""
    k = max(1, int(round(len(y_prob) * 0.05)))
    cutoff = float(np.sort(y_prob)[::-1][k - 1])
    return cutoff, k


def _print_hours_ablation(
    X_train: pd.DataFrame,
    y_train: np.ndarray,
    X_val: pd.DataFrame,
    y_val: np.ndarray,
    X_test: pd.DataFrame,
    y_test: np.ndarray,
    full_proba: np.ndarray,
) -> None:
    variants = [
        ("Full (123 features)", FEATURE_COLS, full_proba),
        ("No hours_into_encounter", NO_HOURS_FEATURES, None),
        ("hours_into_encounter + age + gender only", DEMO_FEATURES, None),
    ]
    rows = []
    for name, cols, cached in variants:
        proba = cached if cached is not None else _fit_lgb_calibrated(
            cols, X_train, y_train, X_val, y_val, X_test,
        )
        rows.append(
            {
                "name": name,
                "n_feat": len(cols),
                "auroc": float(roc_auc_score(y_test, proba)),
                "auprc": float(average_precision_score(y_test, proba)),
            }
        )

    print()
    print("=== Part 1: hours_into_encounter ablation (LightGBM + isotonic) ===")
    print(f"{'Feature set':<44} {'n_feat':>7} {'AUROC':>8} {'AUPRC':>8}")
    print("-" * 70)
    for r in rows:
        print(
            f"{r['name']:<44} {r['n_feat']:>7} "
            f"{_fmt_f(r['auroc']):>8} {_fmt_f(r['auprc']):>8}"
        )


def _print_patient_first_alert(test: pd.DataFrame, proba: np.ndarray) -> None:
    cutoff, k = _top5_cutoff(proba)
    frame = test.copy()
    frame["proba"] = proba
    frame["time_to_onset"] = pd.to_numeric(frame["time_to_onset"], errors="coerce")

    pos = frame[frame[TARGET] == 1]
    onset_by_pid = (
        (pos["hour"] + pos["time_to_onset"]).groupby(pos["patient_id"]).median()
    )
    septic_ids = set(onset_by_pid.index)
    all_ids = frame["patient_id"].unique()
    nonseptic_ids = [pid for pid in all_ids if pid not in septic_ids]

    first_alert: dict = {}
    for pid, grp in frame.groupby("patient_id", sort=False):
        ordered = grp.sort_values("hour")
        hits = ordered[ordered["proba"] >= cutoff]
        if len(hits):
            first_alert[pid] = int(hits["hour"].iloc[0])

    lead_times: list[int] = []
    n_alerted_septic = 0
    for pid in septic_ids:
        onset_h = int(round(float(onset_by_pid.loc[pid])))
        alert_h = first_alert.get(pid)
        if alert_h is None or alert_h > onset_h:
            continue
        n_alerted_septic += 1
        lead_times.append(onset_h - alert_h)

    n_septic = len(septic_ids)
    n_nonseptic = len(nonseptic_ids)
    n_false_alert = sum(1 for pid in nonseptic_ids if pid in first_alert)
    n_missed = n_septic - n_alerted_septic
    leads = np.asarray(lead_times, dtype=float)

    print()
    print("=== Part 2: patient-level first-alert (LightGBM full, top-5% cutoff) ===")
    print(
        f"Cutoff = {_fmt_f(cutoff, 4)}  "
        f"(k={k} of {len(proba)} test rows, same top-5% rank cutoff)"
    )
    print(
        f"Test patients: {len(all_ids)}  "
        f"septic={n_septic}  non-septic={n_nonseptic}"
    )
    print(
        f"Septic with ≥1 alert at/before onset: {n_alerted_septic}  "
        f"missed={n_missed}"
    )
    print(f"Non-septic with ≥1 alert ever:        {n_false_alert}")
    print()
    print(
        f"Sensitivity (patient):    "
        f"{_fmt_pct(n_alerted_septic / n_septic if n_septic else 0)}  "
        f"({n_alerted_septic}/{n_septic})"
    )
    print(
        f"False-alert rate (pt):    "
        f"{_fmt_pct(n_false_alert / n_nonseptic if n_nonseptic else 0)}  "
        f"({n_false_alert}/{n_nonseptic})"
    )
    if leads.size:
        print(
            f"Lead time (alerted septic):  "
            f"median={np.median(leads):.1f}h  mean={leads.mean():.1f}h  "
            f"n={leads.size}"
        )
        print("Lead-time distribution among correctly alerted septic patients")
        print(f"{'lead time':<12} {'n':>8} {'pct of alerted':>16}")
        print("-" * 40)
        for hours in (1, 2, 4, 6):
            n = int((leads >= hours).sum())
            print(
                f">={hours}h{'':<8} {n:>8} "
                f"{100.0 * n / leads.size:>15.1f}%"
            )
    else:
        print("Lead time (alerted septic):  n/a (no correctly alerted patients)")


def _add_interaction_features(frame: pd.DataFrame) -> pd.DataFrame:
    out = frame.copy()
    out["map_declining_4h"] = (out["map_slope_4h"] < -1.0).fillna(False).astype(int)
    out["lactate_rising_4h"] = (out["lactate_slope_4h"] > 0.3).fillna(False).astype(int)
    out["hr_rising_4h"] = (out["hr_slope_4h"] > 2.0).fillna(False).astype(int)
    out["resp_rising_4h"] = (out["resp_slope_4h"] > 1.0).fillna(False).astype(int)
    out["deterioration_combo_count"] = (
        out["map_declining_4h"]
        + out["lactate_rising_4h"]
        + out["hr_rising_4h"]
        + out["resp_rising_4h"]
    )
    return out


def _auprc_2_to_6h(
    y_true: np.ndarray, y_prob: np.ndarray, time_to_onset: np.ndarray,
) -> tuple[float, int, int]:
    """Positives with 2 <= tto <= 6, plus all negatives."""
    is_pos = y_true == 1
    in_window = (
        is_pos
        & ~np.isnan(time_to_onset)
        & (time_to_onset >= 2)
        & (time_to_onset <= 6)
    )
    is_neg = y_true == 0
    mask = in_window | is_neg
    n_pos = int(in_window.sum())
    n_neg = int(is_neg.sum())
    return float(average_precision_score(y_true[mask], y_prob[mask])), n_pos, n_neg


def _print_final_physio_interactions(
    train: pd.DataFrame,
    val: pd.DataFrame,
    test: pd.DataFrame,
    y_train: np.ndarray,
    y_val: np.ndarray,
    y_test: np.ndarray,
    tto_test: np.ndarray,
) -> None:
    assert len(PHYSIO_FEATURES) == 120, len(PHYSIO_FEATURES)
    assert len(PHYSIO_INTERACTION_FEATURES) == 125, len(PHYSIO_INTERACTION_FEATURES)

    train_i = _add_interaction_features(train)
    val_i = _add_interaction_features(val)
    test_i = _add_interaction_features(test)

    variants = [
        ("hours_into_encounter + age + gender only", DEMO_FEATURES, train, val, test),
        (
            "Physiology without interactions (no hours)",
            NO_HOURS_FEATURES,
            train,
            val,
            test,
        ),
        (
            "Physiology + interaction flags (no demo)",
            PHYSIO_INTERACTION_FEATURES,
            train_i,
            val_i,
            test_i,
        ),
    ]
    rows = []
    n_pos = n_neg = 0
    for name, cols, tr, va, te in variants:
        proba = _fit_lgb_calibrated(cols, tr, y_train, va, y_val, te)
        auprc, n_pos, n_neg = _auprc_2_to_6h(y_test, proba, tto_test)
        rows.append({"name": name, "n_feat": len(cols), "auprc": auprc})

    print()
    print("=== Final experiment: physiology + interaction flags (2-6h window) ===")
    print("Flags from trailing-4h slopes (missing slope → 0):")
    print("  map_declining_4h:  map_slope_4h < -1")
    print("  lactate_rising_4h: lactate_slope_4h > 0.3")
    print("  hr_rising_4h:      hr_slope_4h > 2")
    print("  resp_rising_4h:    resp_slope_4h > 1")
    print("  deterioration_combo_count: sum of the four (0-4)")
    print(
        "Cutoffs kept as specified (near train p75–p90 of non-null slopes)."
    )
    print(
        f"2-6h subset: positives with 2<=time_to_onset<=6 (n={n_pos}) "
        f"+ all test negatives (n={n_neg})"
    )
    print()
    print(f"{'Model':<50} {'AUPRC (2-6h window only)':>26}")
    print("-" * 78)
    for r in rows:
        print(f"{r['name']:<50} {_fmt_f(r['auprc']):>26}")


def main() -> None:
    if not DATASET_CSV.exists():
        raise FileNotFoundError(
            f"{DATASET_CSV} not found. Run build_temporal_forecast_dataset_v2.py first."
        )

    df = pd.read_csv(DATASET_CSV)
    train = df[df["split"] == "train"]
    val = df[df["split"] == "validation"]
    test = df[df["split"] == "test"]
    X_train, y_train = train[FEATURE_COLS], train[TARGET].to_numpy(dtype=int)
    X_val, y_val = val[FEATURE_COLS], val[TARGET].to_numpy(dtype=int)
    X_test, y_test = test[FEATURE_COLS], test[TARGET].to_numpy(dtype=int)
    tto_test = pd.to_numeric(test["time_to_onset"], errors="coerce").to_numpy(dtype=float)

    print("=== Forecast model v2 (temporal features, full test landmarks) ===")
    print("Backend: LightGBM (lightgbm 4.6.0); XGBoost not used.")
    print(
        f"Train {len(train)} rows / {train['patient_id'].nunique()} pts  |  "
        f"Val {len(val)} / {val['patient_id'].nunique()}  |  "
        f"Test {len(test)} / {test['patient_id'].nunique()}"
    )
    print(
        f"Test prevalence: {y_test.mean()*100:.2f}%  "
        f"({int(y_test.sum())}/{len(y_test)})"
    )
    print("Features:", len(FEATURE_COLS), "(no time_to_onset / split / id leakage)")
    print()

    lr = _lr_estimator()
    lr.fit(X_train, y_train)
    lr_cal = _calibrate(lr, X_val, y_val)
    lr_proba = lr_cal.predict_proba(X_test)[:, 1]

    lgb = _lgb_estimator()
    lgb.fit(X_train, y_train)
    lgb_cal = _calibrate(lgb, X_val, y_val)
    lgb_proba = lgb_cal.predict_proba(X_test)[:, 1]

    models = [
        ("Logistic (balanced + isotonic)", lr_proba, None),
        ("LightGBM (is_unbalance + isotonic)", lgb_proba, lgb),
    ]

    summaries = []
    for name, proba, base in models:
        auroc = float(roc_auc_score(y_test, proba))
        auprc = float(average_precision_score(y_test, proba))
        brier = float(brier_score_loss(y_test, proba))
        topk = [_topk_metrics(y_test, proba, f) for f in TOPK_FRACS]
        cal = _calibration_table(y_test, proba)
        lead = _lead_time_auprc(y_test, proba, tto_test)
        top5 = next(r for r in topk if abs(r["frac"] - 0.05) < 1e-9)
        summaries.append(
            {
                "name": name,
                "auroc": auroc,
                "auprc": auprc,
                "brier": brier,
                "top5_prec": top5["precision"],
                "top5_rec": top5["recall"],
                "topk": topk,
                "cal": cal,
                "lead": lead,
                "base": base,
            }
        )

        print(f"--- {name} ---")
        print(f"AUROC={_fmt_f(auroc)}  AUPRC={_fmt_f(auprc)}  Brier={_fmt_f(brier, 4)}")
        print()
        print(f"{'Bucket':<10} {'n':>8}  {'mean_pred':>10}  {'observed+':>10}")
        print("-" * 44)
        for row in cal:
            print(
                f"{row['bucket']:<10} {row['n']:>8}  "
                f"{_fmt_pct(row['mean_pred']):>10}  {_fmt_pct(row['observed']):>10}"
            )
        print()
        print(f"{'Top-k':<10} {'k':>8}  {'Prec':>8}  {'Rec':>8}")
        print("-" * 40)
        for row in topk:
            print(
                f"{100.0 * row['frac']:.0f}%{'':<7} {row['k']:>8}  "
                f"{_fmt_pct(row['precision']):>8}  {_fmt_pct(row['recall']):>8}"
            )
        print()
        print("Lead-time-stratified AUPRC (bucket positives + all test negatives)")
        print(f"{'tto bucket':<12} {'n_pos':>8}  {'AUPRC':>8}")
        print("-" * 32)
        for row in lead:
            print(
                f"{row['bucket']:<12} {row['n_pos']:>8}  {_fmt_f(row['auprc']):>8}"
            )
        print()

    lgb_summary = next(s for s in summaries if s["base"] is not None)
    gain = lgb_summary["base"].booster_.feature_importance(importance_type="gain")
    imp = (
        pd.Series(gain, index=FEATURE_COLS)
        .sort_values(ascending=False)
        .head(15)
    )
    print("LightGBM feature importance (top 15 by gain)")
    print(f"{'rank':<6} {'feature':<28} {'gain':>12}")
    print("-" * 48)
    for i, (feat, g) in enumerate(imp.items(), start=1):
        print(f"{i:<6} {feat:<28} {g:>12.1f}")
    print()

    print("=== Summary ===")
    print(
        f"{'Model':<38} {'AUROC':>7} {'AUPRC':>7} {'Brier':>8} "
        f"{'Top5% P':>9} {'Top5% R':>9}"
    )
    print("-" * 82)
    for s in summaries:
        print(
            f"{s['name']:<38} {_fmt_f(s['auroc']):>7} {_fmt_f(s['auprc']):>7} "
            f"{_fmt_f(s['brier'], 4):>8} {_fmt_pct(s['top5_prec']):>9} "
            f"{_fmt_pct(s['top5_rec']):>9}"
        )
    print()
    print("Lead-time AUPRC by model")
    print(f"{'Model':<38} {'0-1h':>8} {'1-2h':>8} {'2-4h':>8} {'4-6h':>8}")
    print("-" * 74)
    for s in summaries:
        by_b = {r["bucket"]: r["auprc"] for r in s["lead"]}
        print(
            f"{s['name']:<38} "
            + " ".join(_fmt_f(by_b[b[0]]).rjust(8) for b in LEAD_BUCKETS)
        )

    _print_hours_ablation(
        X_train, y_train, X_val, y_val, X_test, y_test, lgb_proba,
    )
    _print_patient_first_alert(test, lgb_proba)
    _print_final_physio_interactions(
        train, val, test, y_train, y_val, y_test, tto_test,
    )


if __name__ == "__main__":
    main()
