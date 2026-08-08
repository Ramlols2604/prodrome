"""Unit tests for deterministic classification rules in main.py."""

from main import (
    compute_baseline_risk,
    compute_labs_verdict,
    compute_trajectory_trend,
    compute_vitals_verdict,
)


NORMAL_VITAL_FLAGS = {
    "hr_status": "normal",
    "map_status": "normal",
    "sbp_status": "normal",
    "resp_status": "normal",
    "temp_status": "normal",
}

UNKNOWN_VITAL_FLAGS = {
    "hr_status": "unknown",
    "map_status": "unknown",
    "sbp_status": "unknown",
    "resp_status": "unknown",
    "temp_status": "unknown",
}

NOT_DRAWN_LAB_FLAGS = {
    "lactate_status": "not_drawn",
    "wbc_status": "not_drawn",
    "creatinine_status": "not_drawn",
    "platelets_status": "not_drawn",
    "bun_status": "not_drawn",
}

NORMAL_LAB_FLAGS = {
    "lactate_status": "normal",
    "wbc_status": "normal",
    "creatinine_status": "normal",
    "platelets_status": "normal",
    "bun_status": "normal",
}


def _vital_hour(icu_hour, **flag_overrides):
    flags = dict(NORMAL_VITAL_FLAGS)
    flags.update(flag_overrides)
    return {"icu_hour": icu_hour, "flags": flags}


def _lab_hour(icu_hour, drawn=False, values=None, **flag_overrides):
    flags = dict(NOT_DRAWN_LAB_FLAGS if not drawn else NORMAL_LAB_FLAGS)
    flags.update(flag_overrides)
    hour = {
        "icu_hour": icu_hour,
        "lactate": None,
        "wbc": None,
        "creatinine": None,
        "platelets": None,
        "bun": None,
        "flags": flags,
    }
    if values:
        hour.update(values)
    return hour


# --- compute_vitals_verdict -------------------------------------------------

def test_vitals_all_normal_is_stable():
    window = [_vital_hour(i) for i in range(6)]
    assert compute_vitals_verdict(window) == "STABLE"


def test_vitals_one_abnormal_flag_is_watch():
    window = [_vital_hour(i) for i in range(6)]
    window[2] = _vital_hour(2, hr_status="tachycardia")
    assert compute_vitals_verdict(window) == "WATCH"


def test_vitals_three_plus_flags_abnormal_in_majority_is_deteriorating():
    window = []
    for i in range(6):
        if i < 4:
            window.append(_vital_hour(
                i,
                hr_status="tachycardia",
                map_status="low_perfusion_concern",
                resp_status="tachypnea",
            ))
        else:
            window.append(_vital_hour(i))
    assert compute_vitals_verdict(window) == "DETERIORATING"


def test_vitals_sustained_hypotension_plus_two_others_is_critical():
    window = [
        _vital_hour(
            i,
            sbp_status="hypotension",
            hr_status="tachycardia",
            map_status="low_perfusion_concern",
        )
        for i in range(6)
    ]
    assert compute_vitals_verdict(window) == "CRITICAL"


def test_vitals_hypotension_in_exactly_half_hours_is_not_critical():
    window = []
    for i in range(6):
        if i < 3:
            window.append(_vital_hour(i, sbp_status="hypotension"))
        else:
            window.append(_vital_hour(i))
    verdict = compute_vitals_verdict(window)
    assert verdict != "CRITICAL"
    assert verdict == "WATCH"


def test_vitals_empty_window_is_stable():
    assert compute_vitals_verdict([]) == "STABLE"


def test_vitals_all_unknown_flags_is_stable():
    window = [{"icu_hour": i, "flags": dict(UNKNOWN_VITAL_FLAGS)} for i in range(6)]
    assert compute_vitals_verdict(window) == "STABLE"


# --- compute_labs_verdict ---------------------------------------------------

def test_labs_none_drawn_is_stable():
    window = [_lab_hour(i, drawn=False) for i in range(12)]
    assert compute_labs_verdict(window, labs_drawn_count=0) == "STABLE"


def test_labs_all_drawn_normal_is_stable():
    window = [
        _lab_hour(i, drawn=True, values={"lactate": 1.2, "wbc": 8.0})
        if i % 3 == 0 else _lab_hour(i, drawn=False)
        for i in range(12)
    ]
    assert compute_labs_verdict(window, labs_drawn_count=4) == "STABLE"


def test_labs_single_abnormal_drawn_once_is_watch():
    window = [_lab_hour(i, drawn=False) for i in range(12)]
    window[3] = _lab_hour(
        3,
        drawn=True,
        values={"lactate": 2.5, "wbc": 8.0},
        lactate_status="elevated",
    )
    assert compute_labs_verdict(window, labs_drawn_count=1) == "WATCH"


def test_labs_critical_lactate_plus_other_abnormal_in_majority_is_critical():
    window = []
    drawn = 0
    for i in range(12):
        if i % 2 == 0:
            drawn += 1
            window.append(_lab_hour(
                i,
                drawn=True,
                values={"lactate": 4.8, "wbc": 17.0},
                lactate_status="critical",
                wbc_status="leukocytosis",
            ))
        else:
            window.append(_lab_hour(i, drawn=False))
    assert compute_labs_verdict(window, labs_drawn_count=drawn) == "CRITICAL"


def test_labs_critical_lactate_alone_is_not_critical():
    window = []
    drawn = 0
    for i in range(12):
        if i % 2 == 0:
            drawn += 1
            window.append(_lab_hour(
                i,
                drawn=True,
                values={"lactate": 4.8, "wbc": 8.0},
                lactate_status="critical",
            ))
        else:
            window.append(_lab_hour(i, drawn=False))
    verdict = compute_labs_verdict(window, labs_drawn_count=drawn)
    assert verdict != "CRITICAL"
    assert verdict == "WATCH"


def test_labs_two_abnormal_together_in_majority_without_critical_is_deteriorating():
    window = []
    drawn = 0
    for i in range(12):
        if i % 2 == 0:
            drawn += 1
            window.append(_lab_hour(
                i,
                drawn=True,
                values={"lactate": 3.0, "wbc": 17.0},
                lactate_status="elevated",
                wbc_status="leukocytosis",
            ))
        else:
            window.append(_lab_hour(i, drawn=False))
    assert compute_labs_verdict(window, labs_drawn_count=drawn) == "DETERIORATING"


def test_labs_exactly_half_drawn_hours_abnormal_is_not_majority():
    # 4 drawn hours; half = 2. Exactly 2 hours with 2+ abnormal labs is not > half.
    window = [
        _lab_hour(0, drawn=True, values={"lactate": 3.0, "wbc": 17.0},
                  lactate_status="elevated", wbc_status="leukocytosis"),
        _lab_hour(1, drawn=True, values={"lactate": 3.1, "wbc": 16.5},
                  lactate_status="elevated", wbc_status="leukocytosis"),
        _lab_hour(2, drawn=True, values={"lactate": 1.2, "wbc": 8.0}),
        _lab_hour(3, drawn=True, values={"lactate": 1.1, "wbc": 8.2}),
    ]
    verdict = compute_labs_verdict(window, labs_drawn_count=4)
    assert verdict != "DETERIORATING"
    assert verdict != "CRITICAL"
    assert verdict == "WATCH"


# --- compute_baseline_risk --------------------------------------------------

def test_baseline_risk_age_boundaries():
    cases = [
        (39, "standard", "LOW"),
        (40, "standard", "MODERATE"),
        (64, "standard", "MODERATE"),
        (65, "elevated", "ELEVATED"),
        (79, "elevated", "ELEVATED"),
        (80, "high", "HIGH"),
    ]
    for age, category, level in cases:
        result = compute_baseline_risk(float(age), "MICU/SICU (Unit1)")
        assert result["age_risk_category"] == category, age
        assert result["baseline_risk_level"] == level, age


# --- compute_trajectory_trend -----------------------------------------------

def _traj_row(icu_hour, hr=None, resp=None, lactate=None, wbc=None):
    return {
        "icu_hour": icu_hour,
        "hr": hr,
        "resp": resp,
        "lactate": lactate,
        "wbc": wbc,
    }


def test_trajectory_fewer_than_four_points_is_insufficient_for_that_signal():
    trajectory = [
        _traj_row(0, hr=80, resp=16, lactate=1.2, wbc=8.0),
        _traj_row(1, hr=81, resp=16, lactate=None, wbc=None),
        _traj_row(2, hr=80, resp=17, lactate=1.3, wbc=8.1),
        _traj_row(3, hr=82, resp=16, lactate=None, wbc=None),
        _traj_row(4, hr=81, resp=16, lactate=1.2, wbc=8.0),
        _traj_row(5, hr=80, resp=17, lactate=None, wbc=None),
    ]
    result = compute_trajectory_trend(trajectory)
    assert result["lactate_trend"] == "insufficient_data"
    assert result["wbc_trend"] == "insufficient_data"
    assert result["hr_trend"] != "insufficient_data"
    assert result["resp_trend"] != "insufficient_data"


def test_trajectory_clear_worsening_trend():
    trajectory = [
        _traj_row(i, hr=80.0 if i < 4 else 100.0, resp=16.0, lactate=1.2, wbc=8.0)
        for i in range(8)
    ]
    result = compute_trajectory_trend(trajectory)
    assert result["hr_trend"] == "worsening"


def test_trajectory_clear_improving_trend():
    trajectory = [
        _traj_row(i, hr=100.0 if i < 4 else 80.0, resp=16.0, lactate=1.2, wbc=8.0)
        for i in range(8)
    ]
    result = compute_trajectory_trend(trajectory)
    assert result["hr_trend"] == "improving"


def test_trajectory_flat_trend_is_stable():
    trajectory = [
        _traj_row(i, hr=80.0, resp=16.0, lactate=1.2, wbc=8.0)
        for i in range(8)
    ]
    result = compute_trajectory_trend(trajectory)
    assert result["hr_trend"] == "stable"
    assert result["resp_trend"] == "stable"
    assert result["lactate_trend"] == "stable"
    assert result["wbc_trend"] == "stable"
    assert result["overall_trajectory"] == "STABLE"
    assert result["hours_in_encounter"] == 8


def test_trajectory_overall_three_plus_worsening():
    trajectory = [
        _traj_row(
            i,
            hr=80.0 if i < 4 else 100.0,
            resp=16.0 if i < 4 else 22.0,
            lactate=1.2 if i < 4 else 3.0,
            wbc=8.0,
        )
        for i in range(8)
    ]
    result = compute_trajectory_trend(trajectory)
    assert result["hr_trend"] == "worsening"
    assert result["resp_trend"] == "worsening"
    assert result["lactate_trend"] == "worsening"
    assert result["overall_trajectory"] == "WORSENING"


def test_trajectory_overall_three_plus_improving():
    trajectory = [
        _traj_row(
            i,
            hr=100.0 if i < 4 else 80.0,
            resp=22.0 if i < 4 else 16.0,
            lactate=3.0 if i < 4 else 1.2,
            wbc=8.0,
        )
        for i in range(8)
    ]
    result = compute_trajectory_trend(trajectory)
    assert result["hr_trend"] == "improving"
    assert result["resp_trend"] == "improving"
    assert result["lactate_trend"] == "improving"
    assert result["overall_trajectory"] == "IMPROVING"


def test_trajectory_overall_mixed():
    trajectory = [
        _traj_row(
            i,
            hr=80.0 if i < 4 else 100.0,
            resp=22.0 if i < 4 else 16.0,
            lactate=1.2,
            wbc=8.0,
        )
        for i in range(8)
    ]
    result = compute_trajectory_trend(trajectory)
    assert result["hr_trend"] == "worsening"
    assert result["resp_trend"] == "improving"
    assert result["overall_trajectory"] == "MIXED"


def test_trajectory_overall_mostly_stable_or_insufficient_is_stable():
    trajectory = [
        _traj_row(i, hr=80.0 if i < 4 else 100.0, resp=16.0, lactate=None, wbc=None)
        for i in range(8)
    ]
    result = compute_trajectory_trend(trajectory)
    assert result["hr_trend"] == "worsening"
    assert result["lactate_trend"] == "insufficient_data"
    assert result["wbc_trend"] == "insufficient_data"
    assert result["overall_trajectory"] == "STABLE"
