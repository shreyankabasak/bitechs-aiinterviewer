import json
from pathlib import Path

import planner

DATA = json.loads((Path(__file__).parent.parent / "candidates.json").read_text())["candidates"]


def test_tier_classification():
    assert planner._tier({"skipped": True}) == "skipped"
    assert planner._tier({"passed": False, "attempts": 2}) == "failed"
    assert planner._tier({"passed": True, "attempts": 1}) == "first_try"
    assert planner._tier({"passed": True, "attempts": 2}) == "moderate"
    assert planner._tier({"passed": True, "attempts": 4}) == "struggled"


def test_every_candidate_meets_minimums():
    for cand in DATA:
        summary = planner.plan_summary(planner.build_plan(cand))
        assert summary["meets_minimums"], cand["member"]["name"]


def test_plan_is_deterministic():
    cand = DATA[0]
    assert planner.build_plan(cand) == planner.build_plan(cand)


def test_struggled_topic_preferred_over_moderate_in_same_module():
    cand = {"member": {"name": "T"}, "missions": [
        {"day": 12, "title": "x", "passed": True, "attempts": 4},   # struggled
        {"day": 10, "title": "y", "passed": True, "attempts": 2},   # moderate
    ]}
    core = [p for p in planner.build_plan(cand) if p["kind"] == "core"]
    same_module = [p for p in core if p["module"] == planner._DAY_TO_MODULE[12]]
    if planner._DAY_TO_MODULE[12] == planner._DAY_TO_MODULE[10]:
        assert same_module[0]["day"] == 12


def test_skipped_topic_is_probed_not_dropped():
    cand = next(c for c in DATA if any(m.get("skipped") for m in c["missions"]))
    plan = planner.build_plan(cand)
    skipped_days = {m["day"] for m in cand["missions"] if m.get("skipped")}
    assert any(p["tier"] == "skipped" and p["day"] in skipped_days for p in plan)


def test_missions_outside_curriculum_are_ignored():
    cand = {"member": {"name": "T"}, "missions": [{"day": 999, "title": "nope", "passed": True, "attempts": 1}]}
    assert planner.build_plan(cand) == []


def test_empty_candidate_gives_empty_plan():
    assert planner.build_plan({"member": {"name": "T"}, "missions": []}) == []


def test_synthesized_candidate_from_role_meets_minimums():
    cand = planner.synthesize_candidate_from_role("Data Analyst")
    assert cand["member"]["jobRole"] == "Data Analyst"
    assert planner.plan_summary(planner.build_plan(cand))["meets_minimums"]
