"""
Deterministic interview planner.

Builds an ordered list of question specs from a candidate profile + the
curriculum, WITHOUT calling an LLM. This guarantees the "8+ questions
across 4+ distinct days" requirement is satisfied structurally, every
single time, regardless of what the model does later.

The LLM's job (in llm.py) is only to *phrase* questions and *score*
answers — never to pick which topics to ask about.
"""

import json
from pathlib import Path

CURRICULUM_PATH = Path(__file__).parent / "curriculum.json"

with open(CURRICULUM_PATH) as f:
    _CURRICULUM = json.load(f)

# day -> module number, for spreading question selection across modules
_DAY_TO_MODULE = {}
for module in _CURRICULUM["modules"]:
    lo, hi = module["days"]
    for d in range(lo, hi + 1):
        _DAY_TO_MODULE[d] = module["n"]

_DAY_TO_TITLE = {d["day"]: d["title"] for d in _CURRICULUM["days"]}

MIN_QUESTIONS = 8
MIN_DAYS = 4
MAX_CORE_QUESTIONS = 8   # keep interview length sane
INCLUDE_CROSSLINK = True
INCLUDE_SKIP_PROBE = True


def _tier(mission: dict) -> str:
    """Classify a mission by the confidence signal it carries."""
    if mission.get("skipped"):
        return "skipped"
    attempts = mission.get("attempts", 1)
    passed = mission.get("passed", True)
    if not passed:
        return "failed"
    if attempts == 1:
        return "first_try"
    if attempts >= 3:
        return "struggled"
    return "moderate"


def build_plan(candidate: dict) -> list[dict]:
    """
    Returns an ordered list of question specs:
      {day, title, module, tier, kind}
    kind is one of: "core", "crosslink", "skip_probe"

    Guarantees: at least MIN_QUESTIONS entries (unless the candidate
    genuinely doesn't have enough missions, which won't happen with
    real 31-day cohort data) spanning at least MIN_DAYS distinct days.
    """
    missions = candidate.get("missions", [])

    # Only consider missions that map to a real curriculum day
    by_module: dict[int, list[dict]] = {}
    for m in missions:
        day = m["day"]
        module = _DAY_TO_MODULE.get(day)
        if module is None:
            continue
        enriched = {**m, "module": module, "title": _DAY_TO_TITLE.get(day, m.get("title", "")), "tier": _tier(m)}
        by_module.setdefault(module, []).append(enriched)

    # Rank preference within a module: struggled/failed topics make the
    # most interesting questions (diagnostic value), then first_try
    # (can go deep/hard), then moderate. Skipped handled separately.
    tier_rank = {"struggled": 0, "failed": 0, "first_try": 1, "moderate": 2, "skipped": 9}

    core_plan: list[dict] = []
    used_days = set()

    # Round 1: one pick per module (spreads across modules first)
    modules_sorted = sorted(by_module.keys())
    for module in modules_sorted:
        candidates_in_module = [m for m in by_module[module] if m["tier"] != "skipped"]
        if not candidates_in_module:
            continue
        candidates_in_module.sort(key=lambda m: tier_rank[m["tier"]])
        pick = candidates_in_module[0]
        core_plan.append({"day": pick["day"], "title": pick["title"], "module": module,
                           "tier": pick["tier"], "kind": "core"})
        used_days.add(pick["day"])
        if len(core_plan) >= MAX_CORE_QUESTIONS:
            break

    # Round 2: fill remaining slots (if MIN_QUESTIONS not yet hit) by
    # picking the next-best remaining mission from any module, cycling.
    if len(core_plan) < MIN_QUESTIONS:
        leftovers = []
        for module in modules_sorted:
            for m in by_module[module]:
                if m["tier"] != "skipped" and m["day"] not in used_days:
                    leftovers.append(m)
        leftovers.sort(key=lambda m: tier_rank[m["tier"]])
        for m in leftovers:
            if len(core_plan) >= MIN_QUESTIONS:
                break
            core_plan.append({"day": m["day"], "title": m["title"], "module": m["module"],
                               "tier": m["tier"], "kind": "core"})
            used_days.add(m["day"])

    # Round 3 (fallback): some candidates skipped so much that there
    # simply aren't MIN_QUESTIONS passed/failed missions to draw on.
    # In that case, skipped topics themselves become core questions —
    # asked diagnostically ("you skipped this, walk me through your
    # understanding anyway") rather than dropped. This still satisfies
    # the day/module spread requirement and is arguably a MORE honest
    # interview for a candidate who skipped heavily.
    used_skip_days = set()
    if len(core_plan) < MIN_QUESTIONS or len({p["day"] for p in core_plan}) < MIN_DAYS:
        skipped_pool = [m for mods in by_module.values() for m in mods
                         if m["tier"] == "skipped" and m["day"] not in used_days]
        for m in skipped_pool:
            if len(core_plan) >= MIN_QUESTIONS:
                break
            core_plan.append({"day": m["day"], "title": m["title"], "module": m["module"],
                               "tier": "skipped", "kind": "core"})
            used_days.add(m["day"])
            used_skip_days.add(m["day"])

    plan = list(core_plan)

    # Cross-day connection question: link two completed (non-skipped)
    # days from different modules that are already in the plan.
    if INCLUDE_CROSSLINK:
        non_skipped_core = [p for p in core_plan if p["tier"] != "skipped"]
        if len(non_skipped_core) >= 2:
            a, b = non_skipped_core[0], non_skipped_core[-1]
            if a["module"] != b["module"]:
                plan.append({
                    "day": None,
                    "title": f"Connection: Day {a['day']} ({a['title']}) -> Day {b['day']} ({b['title']})",
                    "module": None,
                    "tier": "crosslink",
                    "kind": "crosslink",
                    "linked_days": [a["day"], b["day"]],
                })

    # Skip probe: gently surface one skipped topic NOT already pulled
    # in as a fallback core question above.
    if INCLUDE_SKIP_PROBE:
        skipped = [m for mods in by_module.values() for m in mods
                   if m["tier"] == "skipped" and m["day"] not in used_skip_days]
        if skipped:
            pick = skipped[0]
            plan.append({"day": pick["day"], "title": pick["title"], "module": pick["module"],
                          "tier": "skipped", "kind": "skip_probe"})

    return plan


def plan_summary(plan: list[dict]) -> dict:
    core = [p for p in plan if p["kind"] == "core"]
    days = {p["day"] for p in core}
    return {
        "total_questions": len(plan),
        "core_questions": len(core),
        "distinct_days": len(days),
        "meets_minimums": len(core) >= MIN_QUESTIONS and len(days) >= MIN_DAYS,
    }


if __name__ == "__main__":
    with open(Path(__file__).parent / "candidates.json") as f:
        data = json.load(f)

    for cand in data["candidates"]:
        plan = build_plan(cand)
        summary = plan_summary(plan)
        name = cand["member"]["name"]
        status = "OK" if summary["meets_minimums"] else "!! SHORT !!"
        print(f"{name:20s} q={summary['total_questions']:2d} core={summary['core_questions']:2d} "
              f"days={summary['distinct_days']:2d}  {status}")
