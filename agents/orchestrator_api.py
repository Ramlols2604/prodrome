"""
orchestrator_api.py

Thin FastAPI wrapper over the Judge committee. Python still owns
classification; this service only exposes run_judge as HTTP JSON.

Run (from agents/):
    uvicorn orchestrator_api:app --reload --port 8002

Test:
    curl http://localhost:8002/patients/p000003/committee
"""

import os
from pathlib import Path

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from judge import run_judge

load_dotenv(Path(__file__).resolve().parent / ".env")

DATA_SERVICE_URL = os.environ.get("DATA_SERVICE_URL", "http://localhost:8000")

app = FastAPI(title="Prodrome Orchestrator", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok", "data_service_url": DATA_SERVICE_URL}


@app.get("/patients/{patient_id}/committee")
async def committee(patient_id: str):
    try:
        return await run_judge(patient_id, data_service_url=DATA_SERVICE_URL)
    except httpx.HTTPStatusError as exc:
        raise HTTPException(
            status_code=exc.response.status_code,
            detail=exc.response.text,
        ) from exc
    except httpx.RequestError as exc:
        raise HTTPException(
            status_code=503,
            detail=f"data-service unreachable at {DATA_SERVICE_URL}: {exc}",
        ) from exc
