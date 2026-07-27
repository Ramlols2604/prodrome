"""
data_loader.py

Parses PhysioNet/CinC Challenge 2019 sepsis prediction .psv files
(one file per patient, pipe-separated, one row per ICU hour) into a
local SQLite database that the FastAPI service reads from.

Real column schema (fixed by the Challenge, do not change):
HR|O2Sat|Temp|SBP|MAP|DBP|Resp|EtCO2|BaseExcess|HCO3|FiO2|pH|PaCO2|SaO2|
AST|BUN|Alkalinephos|Calcium|Chloride|Creatinine|Bilirubin_direct|Glucose|
Lactate|Magnesium|Phosphate|Potassium|Bilirubin_total|TroponinI|Hct|Hgb|
PTT|WBC|Fibrinogen|Platelets|Age|Gender|Unit1|Unit2|HospAdmTime|ICULOS|
SepsisLabel

Each row = one hour of that patient's ICU stay (ICULOS = ICU length of
stay in hours). SepsisLabel is 1 starting 6 hours before clinical
sepsis onset (per Sepsis-3 criteria used by the Challenge), else 0.
Most lab columns are heavily missing -- that sparsity is itself
clinically meaningful and the Lab Agent should reason about it, not
silently interpolate.
"""

import sqlite3
from pathlib import Path
import pandas as pd

DB_PATH = Path(__file__).parent / "prodrome.db"

VITALS_COLS = ["HR", "O2Sat", "Temp", "SBP", "MAP", "DBP", "Resp", "EtCO2"]
LAB_COLS = [
    "BaseExcess", "HCO3", "FiO2", "pH", "PaCO2", "SaO2", "AST", "BUN",
    "Alkalinephos", "Calcium", "Chloride", "Creatinine", "Bilirubin_direct",
    "Glucose", "Lactate", "Magnesium", "Phosphate", "Potassium",
    "Bilirubin_total", "TroponinI", "Hct", "Hgb", "PTT", "WBC",
    "Fibrinogen", "Platelets",
]
DEMO_COLS = ["Age", "Gender", "Unit1", "Unit2", "HospAdmTime"]
ALL_COLS = VITALS_COLS + LAB_COLS + DEMO_COLS + ["ICULOS", "SepsisLabel"]


def _patient_id_from_filename(path: Path) -> str:
    # p000001.psv -> p000001
    return path.stem


def build_database(data_dir: str, db_path: Path = DB_PATH, reset: bool = True) -> dict:
    """
    Reads every .psv file in data_dir and loads it into prodrome.db.
    Returns a small summary dict (patient count, row count, sepsis count)
    so the caller can sanity-check the load before starting the API.
    """
    data_dir = Path(data_dir)
    psv_files = sorted(data_dir.glob("*.psv"))
    if not psv_files:
        raise FileNotFoundError(
            f"No .psv files found in {data_dir}. "
            "Run download_data.sh first, or point --data-dir at sample_data/ "
            "for a small synthetic test set."
        )

    if reset and db_path.exists():
        db_path.unlink()

    conn = sqlite3.connect(db_path)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS hourly_records (
            patient_id TEXT,
            icu_hour INTEGER,
            hr REAL, o2sat REAL, temp REAL, sbp REAL, map REAL, dbp REAL,
            resp REAL, etco2 REAL,
            base_excess REAL, hco3 REAL, fio2 REAL, ph REAL, paco2 REAL,
            sao2 REAL, ast REAL, bun REAL, alkalinephos REAL, calcium REAL,
            chloride REAL, creatinine REAL, bilirubin_direct REAL,
            glucose REAL, lactate REAL, magnesium REAL, phosphate REAL,
            potassium REAL, bilirubin_total REAL, troponin_i REAL,
            hct REAL, hgb REAL, ptt REAL, wbc REAL, fibrinogen REAL,
            platelets REAL,
            age REAL, gender INTEGER, unit1 REAL, unit2 REAL,
            hosp_adm_time REAL,
            sepsis_label INTEGER,
            PRIMARY KEY (patient_id, icu_hour)
        )
    """)

    total_rows = 0
    sepsis_patients = 0

    for path in psv_files:
        pid = _patient_id_from_filename(path)
        df = pd.read_csv(path, sep="|")
        # Guard against files that don't match the expected Challenge schema
        missing = [c for c in ALL_COLS if c not in df.columns]
        if missing:
            raise ValueError(f"{path.name} is missing expected columns: {missing}")

        df = df.reset_index().rename(columns={"index": "icu_hour"})
        if df["SepsisLabel"].max() > 0:
            sepsis_patients += 1

        rows = [
            (
                pid, int(r.icu_hour),
                r.HR, r.O2Sat, r.Temp, r.SBP, r.MAP, r.DBP, r.Resp, r.EtCO2,
                r.BaseExcess, r.HCO3, r.FiO2, r.pH, r.PaCO2, r.SaO2, r.AST,
                r.BUN, r.Alkalinephos, r.Calcium, r.Chloride, r.Creatinine,
                r.Bilirubin_direct, r.Glucose, r.Lactate, r.Magnesium,
                r.Phosphate, r.Potassium, r.Bilirubin_total, r.TroponinI,
                r.Hct, r.Hgb, r.PTT, r.WBC, r.Fibrinogen, r.Platelets,
                r.Age, int(r.Gender), r.Unit1, r.Unit2, r.HospAdmTime,
                int(r.SepsisLabel),
            )
            for r in df.itertuples(index=False)
        ]
        conn.executemany(
            f"INSERT OR REPLACE INTO hourly_records VALUES ({','.join(['?'] * 42)})",
            rows,
        )
        total_rows += len(rows)

    conn.commit()
    conn.close()

    return {
        "patients_loaded": len(psv_files),
        "total_hourly_rows": total_rows,
        "patients_with_sepsis_label": sepsis_patients,
        "db_path": str(db_path),
    }


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Load PhysioNet 2019 psv files into prodrome.db")
    parser.add_argument("--data-dir", default="sample_data",
                         help="Directory containing .psv files (default: sample_data/)")
    args = parser.parse_args()
    summary = build_database(args.data_dir)
    print(f"Loaded {summary['patients_loaded']} patients, "
          f"{summary['total_hourly_rows']} hourly rows, "
          f"{summary['patients_with_sepsis_label']} with a positive sepsis label at some hour.")
    print(f"Database written to {summary['db_path']}")
