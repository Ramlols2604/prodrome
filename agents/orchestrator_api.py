"""
orchestrator_api.py

Thin FastAPI wrapper over the Judge committee. Python still owns
classification; this service only exposes run_judge as HTTP JSON.

LLM narrations are cached per patient_id in a local SQLite file so
repeat views skip Groq. Deterministic verdicts are never cached here —
those live in the data-service /patients/summary and /snapshot routes.

Run (from agents/):
    uvicorn orchestrator_api:app --reload --port 8002

Test:
    curl http://localhost:8002/patients/p000545/committee
"""

import json
import os
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from judge import run_judge

load_dotenv(Path(__file__).resolve().parent / ".env")

DATA_SERVICE_URL = os.environ.get("DATA_SERVICE_URL", "http://localhost:8000")
CACHE_DB = Path(__file__).resolve().parent / "llm_cache.sqlite"

app = FastAPI(title="Prodrome Orchestrator", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def _cache_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(CACHE_DB)
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS llm_cache (
            patient_id TEXT PRIMARY KEY,
            payload TEXT NOT NULL,
            cached_at TEXT NOT NULL
        )
        """
    )
    conn.commit()
    return conn


def _cache_get(patient_id: str) -> Optional[dict]:
    conn = _cache_conn()
    row = conn.execute(
        "SELECT payload, cached_at FROM llm_cache WHERE patient_id = ?",
        (patient_id,),
    ).fetchone()
    conn.close()
    if not row:
        return None
    payload = json.loads(row[0])
    payload["cached"] = True
    payload["cached_at"] = row[1]
    return payload


def _cache_put(patient_id: str, payload: dict) -> None:
    cached_at = datetime.now(timezone.utc).isoformat()
    to_store = {k: v for k, v in payload.items() if k not in ("cached", "cached_at")}
    conn = _cache_conn()
    conn.execute(
        """
        INSERT OR REPLACE INTO llm_cache (patient_id, payload, cached_at)
        VALUES (?, ?, ?)
        """,
        (patient_id, json.dumps(to_store), cached_at),
    )
    conn.commit()
    conn.close()


@app.get("/health")
def health():
    return {"status": "ok", "data_service_url": DATA_SERVICE_URL}


@app.get("/narration-consistency")
def narration_consistency():
    """Aggregate LLM-vs-deterministic agreement from cached committee runs.

    Does not call Groq. Patients never opened on the detail page are absent.
    """
    conn = _cache_conn()
    rows = conn.execute("SELECT payload FROM llm_cache").fetchall()
    conn.close()
    keys = {
        "vitals": "verdict_consistent",
        "labs": "verdict_consistent",
        "risk": "consistent",
        "historical": "consistent",
    }
    agents = {name: {"matched": 0, "n": 0} for name in keys}
    for (raw,) in rows:
        ar = (json.loads(raw) or {}).get("agent_results") or {}
        for name, field in keys.items():
            block = ar.get(name) or {}
            if field not in block:
                continue
            agents[name]["n"] += 1
            if block[field]:
                agents[name]["matched"] += 1
    out = {}
    for name, counts in agents.items():
        n = counts["n"]
        out[name] = {
            "matched": counts["matched"],
            "n": n,
            "pct": round(100.0 * counts["matched"] / n, 1) if n else None,
        }
    return {"cached_patients": len(rows), "agents": out}


@app.get("/patients/{patient_id}/committee")
async def committee(patient_id: str, refresh: bool = Query(False)):
    if not refresh:
        cached = _cache_get(patient_id)
        if cached is not None:
            return cached
    try:
        result = await run_judge(patient_id, data_service_url=DATA_SERVICE_URL)
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
    _cache_put(patient_id, result)
    result["cached"] = False
    return result
