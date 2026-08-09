"""Unit tests for deterministic Judge scoring (no LLM)."""

import pytest

from judge import compute_committee_verdict, trajectory_severity, verdict_severity


def test_all_stable_is_stable_with_zero_dissent():
    result = compute_committee_verdict("STABLE", "STABLE", "STABLE")
    assert result["committee_verdict"] == "STABLE"
    assert result["dissent_score"] == 0.0
    assert result["vitals_severity"] == 0
    assert result["labs_severity"] == 0
    assert result["historical_severity"] == 0


def test_critical_plus_deteriorating_plus_worsening_is_critical():
    result = compute_committee_verdict("CRITICAL", "DETERIORATING", "WORSENING")
    assert result["vitals_severity"] == 3
    assert result["labs_severity"] == 2
    assert result["historical_severity"] == 2
    assert result["committee_verdict"] == "CRITICAL"
    assert result["dissent_score"] == 33.3


def test_vitals_critical_others_stable_is_max_dissent():
    result = compute_committee_verdict("CRITICAL", "STABLE", "STABLE")
    assert result["committee_verdict"] == "CRITICAL"
    assert result["dissent_score"] == 100.0
    assert result["max_severity"] == 3
    assert result["min_severity"] == 0


def test_two_deteriorating_one_stable_is_deteriorating():
    result = compute_committee_verdict("DETERIORATING", "DETERIORATING", "STABLE")
    assert result["vitals_severity"] == 2
    assert result["labs_severity"] == 2
    assert result["historical_severity"] == 0
    assert result["committee_verdict"] == "DETERIORATING"
    assert result["dissent_score"] == 66.7


def test_single_deteriorating_is_watch_not_deteriorating():
    result = compute_committee_verdict("DETERIORATING", "STABLE", "STABLE")
    assert result["vitals_severity"] == 2
    assert result["labs_severity"] == 0
    assert result["historical_severity"] == 0
    assert result["committee_verdict"] == "WATCH"
    assert result["dissent_score"] == 66.7


def test_single_watch_is_watch():
    result = compute_committee_verdict("WATCH", "STABLE", "STABLE")
    assert result["committee_verdict"] == "WATCH"
    assert result["dissent_score"] == 33.3


def test_invalid_verdict_raises_value_error():
    with pytest.raises(ValueError):
        verdict_severity("UNKNOWN")
    with pytest.raises(ValueError):
        trajectory_severity("CRITICAL")
    with pytest.raises(ValueError):
        compute_committee_verdict("NOT_A_VERDICT", "STABLE", "STABLE")
