"""Does dissent add predictive value beyond severity alone?

Loads dissent_results.csv and compares logistic models:
  is_septic ~ max_severity_reached
  is_septic ~ max_dissent_score
  is_septic ~ max_severity_reached + max_dissent_score

AUROC via 5-fold stratified CV (sklearn). Coefficient/p-value for
dissent from a full-sample statsmodels Logit (sklearn does not report
p-values).
"""

from __future__ import annotations

from pathlib import Path

import pandas as pd
import statsmodels.api as sm
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import StratifiedKFold, cross_val_score
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

RESULTS_CSV = Path(__file__).resolve().parent / "dissent_results.csv"


def _lr_pipeline() -> Pipeline:
    # Unpenalized LR so L2 shrinkage does not distort AUROC when features
    # are on different scales. Scaler is for numerical stability only.
    return Pipeline(
        [
            ("scaler", StandardScaler()),
            (
                "lr",
                LogisticRegression(
                    penalty=None,
                    solver="lbfgs",
                    max_iter=1000,
                    random_state=42,
                ),
            ),
        ]
    )


def _cv_auroc(X: pd.DataFrame, y: pd.Series) -> tuple[float, float]:
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    scores = cross_val_score(_lr_pipeline(), X, y, cv=cv, scoring="roc_auc")
    return float(scores.mean()), float(scores.std())


def main() -> None:
    if not RESULTS_CSV.exists():
        raise FileNotFoundError(
            f"{RESULTS_CSV} not found. Run dissent_experiment.py first."
        )

    df = pd.read_csv(RESULTS_CSV)
    y = df["is_septic"].astype(int)
    X_sev = df[["max_severity_reached"]]
    X_dis = df[["max_dissent_score"]]
    X_both = df[["max_severity_reached", "max_dissent_score"]]

    auc_sev, std_sev = _cv_auroc(X_sev, y)
    auc_dis, std_dis = _cv_auroc(X_dis, y)
    auc_both, std_both = _cv_auroc(X_both, y)
    delta = auc_both - auc_sev

    X_sm = sm.add_constant(X_both, has_constant="add")
    logit = sm.Logit(y, X_sm).fit(disp=False)
    coef = float(logit.params["max_dissent_score"])
    pval = float(logit.pvalues["max_dissent_score"])
    sev_coef = float(logit.params["max_severity_reached"])
    sev_p = float(logit.pvalues["max_severity_reached"])

    print("=== Dissent beyond severity (Phase B probe) ===")
    print(f"n={len(df)}  septic={int(y.sum())}  non-septic={int((1 - y).sum())}")
    print("AUROC: 5-fold stratified CV, sklearn LogisticRegression")
    print("        (unpenalized, StandardScaler, random_state=42)")
    print("Dissent coef/p: full-sample statsmodels Logit, unscaled features")
    print()
    print(f"{'Model':<30} {'AUROC':>8}")
    print("-" * 40)
    print(f"{'Severity only':<30} {auc_sev:>8.3f}   (std={std_sev:.3f})")
    print(f"{'Dissent only':<30} {auc_dis:>8.3f}   (std={std_dis:.3f})")
    print(f"{'Severity + Dissent':<30} {auc_both:>8.3f}   (std={std_both:.3f})")
    print(f"{'AUROC improvement':<30} {delta:>+8.3f}")
    print()
    print(f"Dissent coefficient: {coef:.4f} (p={pval:.4f})")
    print(f"Severity coefficient: {sev_coef:.4f} (p={sev_p:.4f})")
    print(
        "Dissent units: log-odds per 1 point of max_dissent_score (0–100 scale)."
    )
    sig = "yes, p<0.05" if pval < 0.05 else "no, p>=0.05"
    print(f"Dissent significant after controlling for severity: {sig}")


if __name__ == "__main__":
    main()
