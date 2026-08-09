"""Smoke-test the Lab Agent against known stable/critical sample patients."""

import asyncio
import json

from labs import run_labs_agent


def main():
    for patient_id in ("p000003", "p000001"):
        print("=" * 72)
        print(f"run_labs_agent({patient_id!r})")
        print("=" * 72)
        result = asyncio.run(run_labs_agent(patient_id))
        print(json.dumps(result, indent=2))
        print()


if __name__ == "__main__":
    main()
