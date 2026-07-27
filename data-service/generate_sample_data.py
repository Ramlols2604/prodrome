"""
generate_sample_data.py

Creates a handful of synthetic .psv files matching the real PhysioNet
2019 Challenge schema/format, so the data service and agent pipeline
can be built and tested end-to-end BEFORE downloading the full real
dataset (see download_data.sh). These are NOT real patients -- swap
sample_data/ for the real download before running any evaluation.

Produces:
  p000001.psv - stable patient, no sepsis
  p000002.psv - stable patient, no sepsis (different demographics)
  p000003.psv - clear deterioration -> sepsis onset at hour 30
  p000004.psv - clear deterioration -> sepsis onset at hour 18
  p000005.psv - borderline/contested case: vitals worsen but labs stay
                near-normal for a while (the case where agents should
                genuinely disagree)
"""

import random
from pathlib import Path

random.seed(7)

COLUMNS = [
    "HR", "O2Sat", "Temp", "SBP", "MAP", "DBP", "Resp", "EtCO2",
    "BaseExcess", "HCO3", "FiO2", "pH", "PaCO2", "SaO2", "AST", "BUN",
    "Alkalinephos", "Calcium", "Chloride", "Creatinine", "Bilirubin_direct",
    "Glucose", "Lactate", "Magnesium", "Phosphate", "Potassium",
    "Bilirubin_total", "TroponinI", "Hct", "Hgb", "PTT", "WBC",
    "Fibrinogen", "Platelets", "Age", "Gender", "Unit1", "Unit2",
    "HospAdmTime", "ICULOS", "SepsisLabel",
]

LAB_COLS = set(COLUMNS) - {"HR", "O2Sat", "Temp", "SBP", "MAP", "DBP",
                           "Resp", "EtCO2", "Age", "Gender", "Unit1",
                           "Unit2", "HospAdmTime", "ICULOS", "SepsisLabel"}


def _fmt(v):
    if v is None:
        return "NaN"
    if isinstance(v, float):
        return f"{v:.2f}"
    return str(v)


def make_patient(n_hours: int, age: int, gender: int, unit1: int,
                  deterioration_start=None, sepsis_onset_hour=None,
                  lab_draw_prob=0.35, borderline=False):
    rows = []
    hr, resp, temp, sbp, lactate, wbc = 82.0, 16.0, 37.0, 118.0, 1.2, 8.5

    for hour in range(n_hours):
        deteriorating = deterioration_start is not None and hour >= deterioration_start
        if deteriorating:
            progress = min(1.0, (hour - deterioration_start) / 20)
            hr = 82 + progress * 38 + random.uniform(-2, 2)
            resp = 16 + progress * 14 + random.uniform(-1, 1)
            temp = 37 + progress * 1.8 + random.uniform(-0.2, 0.2)
            sbp = 118 - progress * 30 + random.uniform(-3, 3)
            lactate_val = 1.2 + progress * (1.6 if borderline else 3.6) + random.uniform(-0.1, 0.1)
            wbc_val = 8.5 + progress * (2.0 if borderline else 9.0) + random.uniform(-0.3, 0.3)
        else:
            hr = 82 + random.uniform(-4, 4)
            resp = 16 + random.uniform(-1.5, 1.5)
            temp = 37 + random.uniform(-0.3, 0.3)
            sbp = 118 + random.uniform(-5, 5)
            lactate_val = 1.2 + random.uniform(-0.2, 0.2)
            wbc_val = 8.5 + random.uniform(-0.8, 0.8)

        row = {c: None for c in COLUMNS}
        row["HR"] = round(hr, 1)
        row["O2Sat"] = round(98 - (progress * 6 if deteriorating else 0) + random.uniform(-1, 1), 1) if deteriorating else round(98 + random.uniform(-1, 1), 1)
        row["Temp"] = round(temp, 1)
        row["SBP"] = round(sbp, 1)
        row["MAP"] = round(sbp * 0.67, 1)
        row["DBP"] = round(sbp * 0.6, 1)
        row["Resp"] = round(resp, 1)

        # Labs are drawn sparsely -- most hours have nothing, matching
        # real ICU draw frequency and the dataset's real missingness.
        if random.random() < lab_draw_prob:
            row["Lactate"] = round(lactate_val, 2)
            row["WBC"] = round(wbc_val, 1)
            row["Creatinine"] = round(0.9 + (0.6 if deteriorating else 0) + random.uniform(-0.1, 0.1), 2)
            row["Platelets"] = round(240 - (60 if deteriorating else 0) + random.uniform(-10, 10), 0)
            row["BUN"] = round(14 + (8 if deteriorating else 0) + random.uniform(-2, 2), 1)

        row["Age"] = age
        row["Gender"] = gender
        row["Unit1"] = unit1
        row["Unit2"] = 0 if unit1 == 1 else 1
        row["HospAdmTime"] = round(-random.uniform(0, 48), 2)
        row["ICULOS"] = hour + 1
        row["SepsisLabel"] = 1 if (sepsis_onset_hour is not None and hour >= sepsis_onset_hour) else 0
        rows.append(row)
    return rows


def write_psv(path: Path, rows: list):
    with open(path, "w") as f:
        f.write("|".join(COLUMNS) + "\n")
        for row in rows:
            f.write("|".join(_fmt(row[c]) for c in COLUMNS) + "\n")


def main():
    out_dir = Path(__file__).parent / "sample_data"
    out_dir.mkdir(exist_ok=True)

    patients = {
        "p000001": make_patient(40, age=58, gender=1, unit1=1),
        "p000002": make_patient(36, age=45, gender=0, unit1=0),
        "p000003": make_patient(48, age=71, gender=1, unit1=1,
                                 deterioration_start=10, sepsis_onset_hour=30),
        "p000004": make_patient(30, age=66, gender=0, unit1=1,
                                 deterioration_start=4, sepsis_onset_hour=18),
        "p000005": make_patient(44, age=52, gender=1, unit1=0,
                                 deterioration_start=8, sepsis_onset_hour=None,
                                 borderline=True),
    }
    for pid, rows in patients.items():
        write_psv(out_dir / f"{pid}.psv", rows)
        print(f"wrote {pid}.psv ({len(rows)} hourly rows)")


if __name__ == "__main__":
    main()
