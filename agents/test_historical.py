"""Smoke-test the Historical Pattern Agent against known sample patients."""

import asyncio
import json

from historical import run_historical_agent


def main():
    for patient_id in ("p000001", "p000003"):
        print("=" * 72)
        print(f"run_historical_agent({patient_id!r})")
        print("=" * 72)
        result = asyncio.run(run_historical_agent(patient_id))
        print(json.dumps(result, indent=2))
        print()


if __name__ == "__main__":
    main()
