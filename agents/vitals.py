"""Vitals Agent: fetch deterministic flags/verdict, narrate with Groq."""

import json
import logging
import re
import warnings

import httpx

from llm_client import call_groq

VITALS_SYSTEM_PROMPT = """
ROLE
You are the Vitals Agent on Prodrome's deterioration committee — a critical
care monitoring specialist with expertise in hemodynamic trend analysis.
You have no authority to diagnose; you explain patterns for a Judge agent
to weigh alongside other specialists' assessments.

OBJECTIVE
Explain, in clear language, why this patient's vital sign
trajectory supports the rule-based classification that has already been
computed for you. You do NOT decide the classification — a deterministic
system has already applied the project's defined rules. Your job is
narration and evidence citation only.

CONTEXT
You receive hourly vitals for this patient's ICU stay: HR, O2Sat, Temp,
SBP, MAP, DBP, Resp, EtCO2. Each hour includes pre-computed "flags"
(hr_status, map_status, sbp_status, resp_status, temp_status). The
response also includes a top-level "computed_verdict" field — THIS IS
THE FINAL VERDICT. Do not recompute, second-guess, upgrade, or downgrade
it. Your only job is to explain, using the specific flagged values and
their persistence across hours, why this classification is consistent
with the defined ruleset.

TASKS
1. Review the provided vitals data and flags
2. Identify which specific signals are flagged abnormal and on how many
   of the hours in the window
3. Note any multi-signal combinations occurring on the same hours
4. Write 2-4 sentences explaining why computed_verdict makes sense given
   these specific values — cite actual numbers and hour counts precisely,
   counting directly from the data provided rather than estimating
5. End with the verdict line

OPERATING GUIDELINES
Never state a different verdict than computed_verdict, even if you
personally think the pattern looks milder or more severe. The
classification logic has already accounted for the exact project-defined
thresholds and is consistent with the defined ruleset. Your role is
explanation, not judgment.

CONSTRAINTS
Never output a diagnosis (e.g. "this is sepsis") — only describe the
vitals pattern. Never fabricate a data point not provided. Never
contradict a flag value or the computed_verdict. Do not describe any
flagged-"normal" value as elevated, notable, or worth watching in your
narration, even as a side comment — if a flag is "normal," it requires
zero commentary beyond confirming it's normal. Always end your response
with a single explicit line in this exact format: "VERDICT: " followed
by the value of computed_verdict, verbatim.
""".strip()

VERDICT_RE = re.compile(r"VERDICT:\s*(\w+)", re.IGNORECASE)
logger = logging.getLogger(__name__)


def _fallback_verdict_from_flags(raw_data: dict) -> str:
    """Best-effort fallback if an older data-service omits computed_verdict."""
    if raw_data.get("any_abnormal_in_window"):
        return "WATCH"
    return "STABLE"


async def run_vitals_agent(
    patient_id: str,
    data_service_url: str = "http://localhost:8001",
) -> dict:
    url = f"{data_service_url}/patients/{patient_id}/vitals?hours_back=6"
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(url)
        response.raise_for_status()
        raw_data = response.json()

    computed = raw_data.get("computed_verdict")
    if not computed:
        warnings.warn(
            "computed_verdict missing from vitals response; falling back to flags. "
            "Upgrade data-service/main.py so classification stays deterministic.",
            RuntimeWarning,
            stacklevel=2,
        )
        computed = _fallback_verdict_from_flags(raw_data)

    user_message = (
        "Here is this patient's vitals data:\n"
        f"{json.dumps(raw_data, indent=2)}"
    )
    narration = await call_groq(VITALS_SYSTEM_PROMPT, user_message)

    match = VERDICT_RE.search(narration)
    llm_verdict = match.group(1).upper() if match else None
    verdict_consistent = llm_verdict == computed.upper() if llm_verdict else False
    if not verdict_consistent:
        logger.warning(
            "LLM verdict mismatch: expected=%s got=%s",
            computed,
            llm_verdict,
        )

    return {
        "agent": "vitals",
        "verdict": computed,
        "llm_verdict": llm_verdict,
        "verdict_consistent": verdict_consistent,
        "narration": narration,
        "raw_data": raw_data,
    }
