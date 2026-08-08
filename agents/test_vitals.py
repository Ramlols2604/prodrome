"""Smoke-test the Vitals Agent against known stable/critical sample patients."""

import asyncio
import json

from vitals import run_vitals_agent


def main():
    for patient_id in ("p000003", "p000001"):
        print("=" * 72)
        print(f"run_vitals_agent({patient_id!r})")
        print("=" * 72)
        result = asyncio.run(run_vitals_agent(patient_id))
        print(json.dumps(result, indent=2))
        print()


if __name__ == "__main__":
    main()
