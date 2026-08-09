"""Demographic/Risk Agent: fetch deterministic baseline risk, narrate with Groq."""

import json
import logging
import re
import warnings

import httpx

from llm_client import call_groq

RISK_SYSTEM_PROMPT = """
ROLE
You are the Demographic/Risk Agent on Prodrome's deterioration committee
— a specialist in patient risk stratification based on baseline factors.
You have no authority to diagnose; you provide risk context for a Judge
agent to weigh alongside other specialists' clinical findings.

OBJECTIVE
Explain this patient's baseline risk context based on their
demographics. You do NOT compute the risk level — a deterministic
system has already classified it. Your job is narration only.

CONTEXT
You receive this patient's age, gender, and ICU type, plus a
pre-computed "risk_assessment" object with "age_risk_category" and
"baseline_risk_level". Do NOT recompute these.

TASKS
1. State the patient's age and the resulting baseline_risk_level
2. In 1-2 sentences, explain what this baseline risk level means in
   context -- e.g. an ELEVATED or HIGH baseline means the same clinical
   findings from other agents should be weighted as more urgent, since
   older patients have less physiological reserve to compensate
3. Do not speculate about the patient's actual current condition

OPERATING GUIDELINES
Never state a different baseline_risk_level than provided. Keep your
response brief -- 2-4 sentences.

CONSTRAINTS
Never output a diagnosis. Never fabricate a data point not provided.
This agent does NOT output a STABLE/WATCH/DETERIORATING/CRITICAL
verdict. End your response with exactly: "BASELINE RISK: " followed by
the value of baseline_risk_level, verbatim.
""".strip()

BASELINE_RISK_RE = re.compile(
    r"BASELINE RISK:\s*(LOW|MODERATE|ELEVATED|HIGH)\b",
    re.IGNORECASE,
)
logger = logging.getLogger(__name__)


def _fallback_baseline_risk(raw_data: dict) -> str:
    """Best-effort fallback if risk_assessment.baseline_risk_level is missing."""
    age = raw_data.get("age")
    if age is None:
        return "MODERATE"
    if age >= 80:
        return "HIGH"
    if age >= 65:
        return "ELEVATED"
    if age >= 40:
        return "MODERATE"
    return "LOW"


async def run_risk_agent(
    patient_id: str,
    data_service_url: str = "http://localhost:8000",
) -> dict:
    url = f"{data_service_url}/patients/{patient_id}/demographics"
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(url)
        response.raise_for_status()
        raw_data = response.json()

    computed = (raw_data.get("risk_assessment") or {}).get("baseline_risk_level")
    if not computed:
        warnings.warn(
            "risk_assessment.baseline_risk_level missing from demographics "
            "response; falling back to age-based rules. Upgrade "
            "data-service/main.py so classification stays deterministic.",
            RuntimeWarning,
            stacklevel=2,
        )
        computed = _fallback_baseline_risk(raw_data)

    user_message = (
        "Here is this patient's demographics data:\n"
        f"{json.dumps(raw_data, indent=2)}"
    )
    narration = await call_groq(RISK_SYSTEM_PROMPT, user_message)

    match = BASELINE_RISK_RE.search(narration)
    if match:
        llm_baseline_risk = match.group(1).upper()
    else:
        llm_baseline_risk = None
        logger.warning("LLM did not produce a parseable baseline risk line")
    consistent = (
        llm_baseline_risk == computed.upper() if llm_baseline_risk else False
    )
    if llm_baseline_risk and not consistent:
        logger.warning(
            "LLM baseline risk mismatch: expected=%s got=%s",
            computed,
            llm_baseline_risk,
        )

    return {
        "agent": "risk",
        "baseline_risk": computed,
        "llm_baseline_risk": llm_baseline_risk,
        "consistent": consistent,
        "narration": narration,
        "raw_data": raw_data,
    }
