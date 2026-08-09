"""Judge agent: deterministic committee verdict and dissent score.

No LLM calls here — Python owns classification. Risk-agent baseline is
context only and is intentionally not a vote.
"""


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
