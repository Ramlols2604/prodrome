"""Vitals Agent: fetch deterministic flags/verdict, narrate with Groq."""

import json
import logging
import re
import warnings

import httpx

from llm_client import GroqClientError, call_groq, parse_structured_narration

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
1. Review the provided vitals data and flags as a whole
2. Identify the 2-3 most clinically significant findings driving the
   verdict -- you do not need to mention every signal, only the ones
   that matter most. Cite actual numbers and hour counts precisely,
   counting directly from the data provided rather than estimating
3. Output the required SUMMARY/FINDING format explaining why
   computed_verdict makes sense given those findings
4. End with the verdict line

OPERATING GUIDELINES
Never state a different verdict than computed_verdict, even if you
personally think the pattern looks milder or more severe. The
classification logic has already accounted for the exact project-defined
thresholds and is consistent with the defined ruleset. Your role is
explanation, not judgment.
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
Never output a diagnosis (e.g. "this is sepsis") — only describe the
vitals pattern. Never fabricate a data point not provided. Never
contradict a flag value or the computed_verdict. Do not describe any
flagged-"normal" value as elevated, notable, or worth watching in your
narration, even as a side comment — if a flag is "normal," it requires
zero commentary beyond confirming it's normal. Always end your response
with a single explicit line in this exact format: "VERDICT: " followed
by the value of computed_verdict, verbatim.
""".strip()

VERDICT_RE = re.compile(
    r"VERDICT:\s*(STABLE|WATCH|DETERIORATING|CRITICAL)\b",
    re.IGNORECASE,
)
logger = logging.getLogger(__name__)


def _fallback_verdict_from_flags(raw_data: dict) -> str:
    """Best-effort fallback if an older data-service omits computed_verdict."""
    if raw_data.get("any_abnormal_in_window"):
        return "WATCH"
    return "STABLE"


async def run_vitals_agent(
    patient_id: str,
    data_service_url: str = "http://localhost:8000",
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
    try:
        narration = await call_groq(
            VITALS_SYSTEM_PROMPT,
            user_message,
            request_context=f"vitals:{patient_id}",
        )
        summary, findings = parse_structured_narration(narration)
    except GroqClientError as exc:
        logger.warning("Vitals narration unavailable: %s", exc)
        return {
            "agent": "vitals",
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
        "agent": "vitals",
        "verdict": computed,
        "llm_verdict": llm_verdict,
        "verdict_consistent": verdict_consistent,
        "narration": narration,
        "summary": summary,
        "findings": findings,
        "raw_data": raw_data,
    }
