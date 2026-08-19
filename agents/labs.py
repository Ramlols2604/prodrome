"""Lab Agent: fetch deterministic flags/verdict, narrate with Groq."""

import json
import logging
import re
import warnings

import httpx

from llm_client import GroqClientError, call_groq, parse_structured_narration

LABS_SYSTEM_PROMPT = """
ROLE
You are the Lab Agent on Prodrome's deterioration committee — a
specialist in laboratory trend analysis. You have no authority to
diagnose; you explain patterns for a Judge agent to weigh alongside
other specialists' assessments.

OBJECTIVE
Explain, in clear language, why this patient's lab trajectory supports
the verdict that has already been computed for you. You do NOT decide
the verdict — a deterministic system has already classified it. Your
job is narration and evidence citation only.

CONTEXT
You receive hourly labs for this patient's ICU stay: lactate, WBC,
creatinine, platelets, BUN. Labs are NOT drawn every hour — check
labs_drawn_count against hours_requested first. Each drawn value
includes a pre-computed "flags" status. The response also includes a
top-level "computed_verdict" field — THIS IS THE FINAL VERDICT. Do not
recompute, second-guess, upgrade, or downgrade it.

TASKS
1. Review the provided labs data, flags, and labs_drawn_count as a whole
2. If very few labs were drawn, say so explicitly and note lower
   confidence
3. Identify the 2-3 most clinically significant findings driving the
   verdict -- you do not need to mention every signal, only the ones
   that matter most. Count drawn hours directly from the data provided,
   do not estimate
4. Output the required SUMMARY/FINDING format explaining why
   computed_verdict makes sense given those findings
5. End with the verdict line

OPERATING GUIDELINES
Never state a different verdict than computed_verdict. The
classification logic has already accounted for the exact thresholds and
is consistent with the defined ruleset. Your role is explanation, not
judgment. When citing hour counts, use the exact counts from the data
provided -- double-check against labs_drawn_count before finalizing.
Format your response EXACTLY as follows, with no other text:

SUMMARY: <one sentence, the single most important takeaway>
FINDING: <signal name> — <specific value/flag> — <brief clinical note>
FINDING: <signal name> — <specific value/flag> — <brief clinical note>
FINDING: <signal name> — <specific value/flag> — <brief clinical note>

Include exactly 2-4 FINDING lines, ordered by clinical importance, most
important first. Each FINDING line must be a single line with no line
breaks. Do not add any text before SUMMARY or after the last FINDING
line, other than the required VERDICT/BASELINE RISK/TRAJECTORY line
that follows this format block.

CONSTRAINTS
Never output a diagnosis. Never fabricate a data point not provided.
Never contradict a flag value or computed_verdict. Always end your
response with a single explicit line in this exact format: "VERDICT: "
followed by the value of computed_verdict, verbatim.
""".strip()

VERDICT_RE = re.compile(
    r"VERDICT:\s*(STABLE|WATCH|DETERIORATING|CRITICAL)\b",
    re.IGNORECASE,
)
logger = logging.getLogger(__name__)


def _fallback_verdict_from_flags(raw_data: dict) -> str:
    """Best-effort fallback if an older data-service omits computed_verdict."""
    if raw_data.get("any_abnormal_labs_in_window"):
        return "WATCH"
    return "STABLE"


async def run_labs_agent(
    patient_id: str,
    data_service_url: str = "http://localhost:8000",
) -> dict:
    url = f"{data_service_url}/patients/{patient_id}/labs?hours_back=12"
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(url)
        response.raise_for_status()
        raw_data = response.json()

    computed = raw_data.get("computed_verdict")
    if not computed:
        warnings.warn(
            "computed_verdict missing from labs response; falling back to flags. "
            "Upgrade data-service/main.py so classification stays deterministic.",
            RuntimeWarning,
            stacklevel=2,
        )
        computed = _fallback_verdict_from_flags(raw_data)

    user_message = (
        "Here is this patient's labs data:\n"
        f"{json.dumps(raw_data, indent=2)}"
    )
    try:
        narration = await call_groq(
            LABS_SYSTEM_PROMPT,
            user_message,
            request_context=f"labs:{patient_id}",
        )
        summary, findings = parse_structured_narration(narration)
    except GroqClientError as exc:
        logger.warning("Labs narration unavailable: %s", exc)
        return {
            "agent": "labs",
            "verdict": computed,
            "llm_verdict": None,
            "verdict_consistent": False,
            "narration": "Narration unavailable: LLM request failed",
            "summary": None,
            "findings": [],
            "raw_data": raw_data,
        }

    match = VERDICT_RE.search(narration)
    if match:
        llm_verdict = match.group(1).upper()
    else:
        llm_verdict = None
        logger.warning("LLM did not produce a parseable verdict line")
    verdict_consistent = llm_verdict == computed.upper() if llm_verdict else False
    if llm_verdict and not verdict_consistent:
        logger.warning(
            "LLM verdict mismatch: expected=%s got=%s",
            computed,
            llm_verdict,
        )

    return {
        "agent": "labs",
        "verdict": computed,
        "llm_verdict": llm_verdict,
        "verdict_consistent": verdict_consistent,
        "narration": narration,
        "summary": summary,
        "findings": findings,
        "raw_data": raw_data,
    }
