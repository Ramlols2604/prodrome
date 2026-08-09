# prodrome-data-service

Read-only FastAPI layer over PhysioNet 2019 Challenge sepsis data.
This service knows nothing about agents or LLMs — it only serves
patient time-series data. n8n's Tool nodes (or your production FastAPI
agent backend, later) call these endpoints.

## Setup

```bash
pip install -r requirements.txt --break-system-packages   # or use a venv

# Option A: quick start with synthetic test data (5 patients, already
# matches the real schema, includes a stable / two deteriorating /
# one contested case)
python generate_sample_data.py
python data_loader.py --data-dir sample_data

# Option B: real PhysioNet data (no login/credentialing required)
./download_data.sh
python data_loader.py --data-dir physionet_data/training

# Run the service
uvicorn main:app --reload --port 8000
```

## Test it

```bash
curl http://localhost:8000/health
curl http://localhost:8000/patients
curl "http://localhost:8000/patients/p000003/vitals?hours_back=6"
curl "http://localhost:8000/patients/p000003/labs?hours_back=12"
curl "http://localhost:8000/patients/p000003/demographics"
curl "http://localhost:8000/cohort/outcomes?min_lactate=2.5"
```

## Endpoints (map directly to each agent's Tools)

| Endpoint | Used by | Notes |
|---|---|---|
| `GET /patients` | frontend patient picker, Historical agent | summary per patient |
| `GET /patients/{id}/vitals` | Vitals Agent | trailing window, `hours_back` + optional `up_to_hour` for replay |
| `GET /patients/{id}/labs` | Lab Agent | includes `hours_with_any_lab_drawn` — sparse draws are meaningful, don't interpolate |
| `GET /patients/{id}/demographics` | Demographic/Risk Agent | age, gender, ICU type |
| `GET /patients/{id}/trajectory` | Historical Pattern Agent | this patient's own course so far |
| `GET /cohort/outcomes` | Historical Pattern Agent | population-level rate + sample size (agent must flag low-n) |
| `GET /patients/{id}/ground_truth` | **evaluation only** — never give agents this tool | real sepsis onset hour, for scoring verdict accuracy |

## Synthetic sample_data patients (for dev before the real download)

- `p000001`, `p000002` — stable, never septic
- `p000003` — deterioration starts hour 10, sepsis onset hour 30
- `p000004` — faster deterioration, onset hour 18
- `p000005` — **borderline/contested**: vitals worsen but labs stay
  closer to normal — the case where Vitals and Lab agents should
  genuinely disagree, i.e. the dissent score should be meaningfully
  higher than on p000003/p000004

Swap in real PhysioNet data via `download_data.sh` before running any
real evaluation — these synthetic patients are for pipeline testing
only, not for the accuracy numbers that go in a README/portfolio.
