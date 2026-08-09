"""Historical Pattern Agent: fetch deterministic trajectory trend, narrate with Groq."""

import json
import logging
import re
import warnings

import httpx

from llm_client import call_groq

HISTORICAL_SYSTEM_PROMPT = """
ROLE
You are the Historical Pattern Agent on Prodrome's deterioration
committee — a specialist in longitudinal trend analysis. You have no
authority to diagnose; you provide trajectory context for a Judge agent.

OBJECTIVE
Explain how this patient's own trajectory has evolved over their ICU
stay so far, and (if population data is provided) how this compares to
similar patients. You do NOT compute the trajectory classification — a
deterministic system has already done this.

CONTEXT
You receive this patient's full vitals/labs history so far, with a
pre-computed "trend_analysis" object including "overall_trajectory"
(IMPROVING/WORSENING/MIXED/STABLE) -- trust this completely. You may
also receive population cohort comparison data with a "sample_size" --
if sample_size is small (below 30), you MUST describe any rate from it
as low-confidence, not reliable.

TASKS
1. Report how many hours are in the encounter so far
2. State the overall_trajectory and which individual signals are
   driving it
3. If cohort data was provided, summarize it with an appropriate
   confidence caveat based on its sample size
4. Summarize in 3-5 sentences

OPERATING GUIDELINES
Never state a different overall_trajectory than provided. If cohort
sample_size is small, use hedged language ("in this small sample of X
patients") rather than stating a percentage as a solid finding.

CONSTRAINTS
Never output a diagnosis. Never fabricate a data point not provided.
This agent does NOT output a STABLE/WATCH/DETERIORATING/CRITICAL
verdict. End your response with exactly: "TRAJECTORY: " followed by the
value of overall_trajectory, verbatim.
""".strip()

TRAJECTORY_RE = re.compile(
    r"TRAJECTORY:\s*(STABLE|WATCH|IMPROVING|WORSENING|MIXED)\b",
    re.IGNORECASE,
)
LACTATE_COHORT_THRESHOLD = 4.0
logger = logging.getLogger(__name__)


def _fallback_overall_trajectory(raw_data: dict) -> str:
    """Best-effort fallback if trend_analysis.overall_trajectory is missing."""
    return "STABLE"


def _any_lactate_above_threshold(raw_data: dict, threshold: float) -> bool:
    for row in raw_data.get("trajectory") or []:
        lactate = row.get("lactate")
        if lactate is not None and lactate > threshold:
            return True
    return False


async def run_historical_agent(
    patient_id: str,
    data_service_url: str = "http://localhost:8001",
) -> dict:
    trajectory_url = f"{data_service_url}/patients/{patient_id}/trajectory"
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(trajectory_url)
        response.raise_for_status()
        raw_data = response.json()

        computed = (raw_data.get("trend_analysis") or {}).get("overall_trajectory")
        if not computed:
            warnings.warn(
                "trend_analysis.overall_trajectory missing from trajectory "
                "response; falling back to STABLE. Upgrade data-service/main.py "
                "so classification stays deterministic.",
                RuntimeWarning,
                stacklevel=2,
            )
            computed = _fallback_overall_trajectory(raw_data)

        cohort_data = None
        if _any_lactate_above_threshold(raw_data, LACTATE_COHORT_THRESHOLD):
            cohort_url = (
                f"{data_service_url}/cohort/outcomes"
                f"?min_lactate={LACTATE_COHORT_THRESHOLD}"
            )
            cohort_response = await client.get(cohort_url)
            cohort_response.raise_for_status()
            cohort_data = cohort_response.json()

    user_parts = [
        "Here is this patient's trajectory data:\n"
        f"{json.dumps(raw_data, indent=2)}"
    ]
    if cohort_data is not None:
        user_parts.append(
            "\nHere is population cohort comparison data "
            f"(min_lactate={LACTATE_COHORT_THRESHOLD}):\n"
            f"{json.dumps(cohort_data, indent=2)}"
        )
    else:
        user_parts.append(
            "\nNo population cohort comparison was requested "
            "(no lactate value exceeded 4.0)."
        )
    user_message = "\n".join(user_parts)
    narration = await call_groq(HISTORICAL_SYSTEM_PROMPT, user_message)

    match = TRAJECTORY_RE.search(narration)
    if match:
        llm_trajectory = match.group(1).upper()
    else:
        llm_trajectory = None
        logger.warning("LLM did not produce a parseable trajectory line")
    consistent = (
        llm_trajectory == computed.upper() if llm_trajectory else False
    )
    if llm_trajectory and not consistent:
        logger.warning(
            "LLM trajectory mismatch: expected=%s got=%s",
            computed,
            llm_trajectory,
        )

    return {
        "agent": "historical",
        "overall_trajectory": computed,
        "llm_trajectory": llm_trajectory,
        "consistent": consistent,
        "cohort_context": cohort_data,
        "narration": narration,
        "raw_data": raw_data,
    }
