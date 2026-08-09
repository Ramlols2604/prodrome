"""Judge agent: deterministic committee verdict plus LLM synthesis.

Python owns the committee verdict. Risk-agent baseline is context only
and is intentionally not a vote. The LLM narrates; it never overrides.
"""

import asyncio
import logging
import re

from historical import run_historical_agent
from labs import run_labs_agent
from llm_client import call_groq
from risk import run_risk_agent
from vitals import run_vitals_agent

JUDGE_SYSTEM_PROMPT = """
ROLE
You are the Judge on Prodrome's deterioration committee. You synthesize
four specialist agents' independent findings into one coherent
explanation for a clinician. You have no authority to diagnose or to
override the committee's verdict — a deterministic system has already
computed it.

OBJECTIVE
Explain, in clear language, why the committee reached its verdict, and
explicitly call out any disagreement between agents as a signal worth a
clinician's attention -- disagreement is not noise to be smoothed over,
it is useful information.

CONTEXT
You receive each specialist agent's verdict/status and narration
(Vitals, Labs, Historical Pattern), plus the Risk agent's baseline risk
level and narration (contextual, not part of the verdict computation).
You also receive the already-computed committee_verdict and
dissent_score (0-100, where higher means more disagreement between
Vitals, Labs, and Historical). Trust these completely -- do not
recompute or second-guess them.

TASKS
1. State the committee_verdict and dissent_score
2. Briefly summarize what each of the three voting agents (Vitals,
   Labs, Historical) found
3. If dissent_score is high (above 50), explicitly name which agents
   disagreed and what that disagreement might mean -- e.g. "Vitals
   shows clear deterioration while Labs remains stable, which could
   mean early physiological change not yet reflected in lab values, or
   it could mean the vitals trend is not yet clinically significant --
   this split is exactly the kind of case that benefits from a
   clinician's direct review"
4. Note the Risk agent's baseline risk level as context for how urgently
   the other findings should be treated
5. Keep the synthesis to one clear paragraph, 4-6 sentences

OPERATING GUIDELINES
Never state a different committee_verdict than provided. When dissent
is low, don't manufacture disagreement that isn't there -- just
summarize clearly. When dissent is high, do not resolve it into a false
consensus -- name the disagreement explicitly.

CONSTRAINTS
Never output a diagnosis. Never fabricate a finding not present in the
agent narrations provided. Always end your response with a single
explicit line in this exact format: "COMMITTEE VERDICT: " followed by
the value of committee_verdict, verbatim.
""".strip()

COMMITTEE_VERDICT_RE = re.compile(
    r"COMMITTEE VERDICT:\s*(STABLE|WATCH|DETERIORATING|CRITICAL)\b",
    re.IGNORECASE,
)
logger = logging.getLogger(__name__)


def verdict_severity(verdict: str) -> int:
    mapping = {
        "STABLE": 0,
        "WATCH": 1,
        "DETERIORATING": 2,
        "CRITICAL": 3,
    }
    key = (verdict or "").upper()
    if key not in mapping:
        raise ValueError(f"Unrecognized vitals/labs verdict: {verdict!r}")
    return mapping[key]


def trajectory_severity(trajectory: str) -> int:
    mapping = {
        "STABLE": 0,
        "IMPROVING": 0,
        "MIXED": 1,
        "WORSENING": 2,
    }
    key = (trajectory or "").upper()
    if key not in mapping:
        raise ValueError(f"Unrecognized historical trajectory: {trajectory!r}")
    return mapping[key]


def compute_committee_verdict(
    vitals_verdict: str,
    labs_verdict: str,
    historical_trajectory: str,
) -> dict:
    vitals_severity = verdict_severity(vitals_verdict)
    labs_severity = verdict_severity(labs_verdict)
    historical_severity = trajectory_severity(historical_trajectory)
    severities = [vitals_severity, labs_severity, historical_severity]
    max_severity = max(severities)
    min_severity = min(severities)
    dissent_score = round(((max_severity - min_severity) / 3) * 100, 1)

    if any(s == 3 for s in severities):
        committee_verdict = "CRITICAL"
    elif sum(1 for s in severities if s >= 2) >= 2:
        committee_verdict = "DETERIORATING"
    elif any(s >= 1 for s in severities):
        committee_verdict = "WATCH"
    else:
        committee_verdict = "STABLE"

    return {
        "committee_verdict": committee_verdict,
        "dissent_score": dissent_score,
        "vitals_severity": vitals_severity,
        "labs_severity": labs_severity,
        "historical_severity": historical_severity,
        "max_severity": max_severity,
        "min_severity": min_severity,
    }


def compute_committee_verdict_persistent(
    vitals_verdict: str,
    labs_verdict: str,
    historical_trajectory: str,
) -> dict:
    """Same scoring as compute_committee_verdict, for persistence-filtered inputs.

    Severity mapping, dissent_score, and priority order are identical.
    Call this with verdicts from compute_vitals_verdict_persistent and
    compute_labs_verdict_persistent. Historical trajectory is unchanged;
    Risk remains contextual and is not a vote.
    """
    return compute_committee_verdict(
        vitals_verdict, labs_verdict, historical_trajectory,
    )


async def run_judge(
    patient_id: str,
    data_service_url: str = "http://localhost:8001",
) -> dict:
    vitals_result, labs_result, risk_result, historical_result = await asyncio.gather(
        run_vitals_agent(patient_id, data_service_url),
        run_labs_agent(patient_id, data_service_url),
        run_risk_agent(patient_id, data_service_url),
        run_historical_agent(patient_id, data_service_url),
    )

    scoring = compute_committee_verdict(
        vitals_result["verdict"],
        labs_result["verdict"],
        historical_result["overall_trajectory"],
    )
    committee_verdict = scoring["committee_verdict"]
    dissent_score = scoring["dissent_score"]

    user_message = (
        f"Patient: {patient_id}\n\n"
        f"Computed committee_verdict: {committee_verdict}\n"
        f"Computed dissent_score: {dissent_score}\n\n"
        f"Vitals Agent verdict: {vitals_result['verdict']}\n"
        f"Vitals Agent narration:\n{vitals_result['narration']}\n\n"
        f"Labs Agent verdict: {labs_result['verdict']}\n"
        f"Labs Agent narration:\n{labs_result['narration']}\n\n"
        f"Historical Pattern Agent overall_trajectory: "
        f"{historical_result['overall_trajectory']}\n"
        f"Historical Pattern Agent narration:\n{historical_result['narration']}\n\n"
        f"Risk Agent baseline_risk (contextual, not a vote): "
        f"{risk_result['baseline_risk']}\n"
        f"Risk Agent narration:\n{risk_result['narration']}\n"
    )
    synthesis = await call_groq(JUDGE_SYSTEM_PROMPT, user_message)

    match = COMMITTEE_VERDICT_RE.search(synthesis)
    if match:
        llm_committee_verdict = match.group(1).upper()
    else:
        llm_committee_verdict = None
        logger.warning("LLM did not produce a parseable committee verdict line")
    verdict_consistent = (
        llm_committee_verdict == committee_verdict.upper()
        if llm_committee_verdict
        else False
    )
    if llm_committee_verdict and not verdict_consistent:
        logger.warning(
            "LLM committee verdict mismatch: expected=%s got=%s",
            committee_verdict,
            llm_committee_verdict,
        )

    return {
        "patient_id": patient_id,
        "committee_verdict": committee_verdict,
        "llm_committee_verdict": llm_committee_verdict,
        "verdict_consistent": verdict_consistent,
        "dissent_score": dissent_score,
        "agent_results": {
            "vitals": vitals_result,
            "labs": labs_result,
            "risk": risk_result,
            "historical": historical_result,
        },
        "synthesis": synthesis,
    }
