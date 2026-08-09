"""Build a balanced 300-patient evaluation subset from PhysioNet training PSVs.

Copies sampled files into eval_data/; does not modify the original download.
"""

from __future__ import annotations

import csv
import random
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SRC_DIR = ROOT / "physionet_data" / "training"
DST_DIR = ROOT / "eval_data"
TARGET_PER_CLASS = 150
SEED = 42


def is_septic(path: Path) -> bool:
    with path.open(newline="") as f:
        reader = csv.DictReader(f, delimiter="|")
        if not reader.fieldnames or "SepsisLabel" not in reader.fieldnames:
            raise ValueError(f"{path} is missing a SepsisLabel column")
        for row in reader:
            raw = (row.get("SepsisLabel") or "").strip()
            if not raw or raw.lower() == "nan":
                continue
            try:
                if float(raw) >= 1:
                    return True
            except ValueError:
                continue
    return False


def main() -> None:
    if not SRC_DIR.exists():
        raise FileNotFoundError(
            f"{SRC_DIR} not found. Run ./download_data.sh first."
        )

    psv_files = sorted(SRC_DIR.rglob("*.psv"))
    if not psv_files:
        raise FileNotFoundError(f"No .psv files found under {SRC_DIR}")

    septic: list[Path] = []
    non_septic: list[Path] = []
    for path in psv_files:
        if is_septic(path):
            septic.append(path)
        else:
            non_septic.append(path)

    n_septic_available = len(septic)
    n_non_septic_available = len(non_septic)
    n_septic_sample = min(TARGET_PER_CLASS, n_septic_available)
    n_non_septic_sample = min(TARGET_PER_CLASS, n_non_septic_available)

    random.seed(SEED)
    sampled_septic = random.sample(septic, n_septic_sample) if n_septic_sample else []
    sampled_non_septic = (
        random.sample(non_septic, n_non_septic_sample) if n_non_septic_sample else []
    )

    DST_DIR.mkdir(parents=True, exist_ok=True)
    for src in sampled_septic + sampled_non_septic:
        shutil.copy2(src, DST_DIR / src.name)

    print("eval dataset summary")
    print(f"  total files scanned:           {len(psv_files)}")
    print(f"  total septic in full dataset:  {n_septic_available}")
    print(f"  total non-septic in full dataset: {n_non_septic_available}")
    print(f"  septic sampled into eval_data/:    {n_septic_sample}")
    print(f"  non-septic sampled into eval_data/: {n_non_septic_sample}")
    print(f"  total copied:                  {n_septic_sample + n_non_septic_sample}")
    print(f"  output directory:              {DST_DIR}")
    if n_septic_available < TARGET_PER_CLASS:
        print(
            f"  note: fewer than {TARGET_PER_CLASS} septic patients available; "
            f"used all {n_septic_available}."
        )
    if n_non_septic_available < TARGET_PER_CLASS:
        print(
            f"  note: fewer than {TARGET_PER_CLASS} non-septic patients available; "
            f"used all {n_non_septic_available}."
        )


if __name__ == "__main__":
    main()
