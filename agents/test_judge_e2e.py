"""Smoke-test the Judge agent against known sample patients."""

import asyncio
import json

from judge import run_judge


def main():
    for patient_id in ("p000003", "p000001"):
        print("=" * 72)
        print(f"run_judge({patient_id!r})")
        print("=" * 72)
        result = asyncio.run(run_judge(patient_id))
        print(json.dumps(result, indent=2))
        print()


if __name__ == "__main__":
    main()
