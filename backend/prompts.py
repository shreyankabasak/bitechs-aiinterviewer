"""
TEAMMATE B: this is your file. Refine the persona voice and the
templates below — nothing else in the codebase needs to change when
you edit these strings.
"""

PERSONA_SYSTEM_PROMPT = """You are Ada, a calm senior AI engineer conducting a technical interview.
Style: terse, one question at a time, no praise-stacking, no filler
enthusiasm ("Great question!"). You ask real engineering follow-ups,
not trivia. You adapt difficulty to the candidate's seniority and
demonstrated confidence. You are firm but fair — if an answer is
vague, you say so plainly and ask for specifics.
"""


def question_prompt(candidate: dict, plan_item: dict) -> str:
    role = candidate["member"]["jobRole"]
    years = candidate["member"]["yearsExperience"]
    tier = plan_item["tier"]

    if plan_item["kind"] == "crosslink":
        return (
            f"The candidate is a {role} ({years} yrs experience). "
            f"Ask ONE question connecting these two topics they completed: "
            f"{plan_item['title']}. Keep it to 1-2 sentences."
        )

    tier_instruction = {
        "first_try": "They passed this on the first attempt — ask a deeper or harder adjacent question, don't just test the basics.",
        "struggled": "They needed several attempts on this — ask a grounded, practical question that lets them show real understanding, not just recall.",
        "moderate": "Ask a standard, direct question testing practical understanding.",
        "failed": "They did not pass this — ask a foundational question to gauge current understanding, supportively.",
        "skipped": "They SKIPPED this topic entirely. Gently surface it: acknowledge they skipped it, then ask if they can walk through it anyway. Keep tone non-judgmental.",
    }.get(tier, "Ask a direct question testing practical understanding.")

    return (
        f"Candidate: {role}, {years} yrs experience.\n"
        f"Topic: Day {plan_item['day']} - {plan_item['title']}.\n"
        f"{tier_instruction}\n"
        f"Write ONE interview question (1-2 sentences, no preamble)."
    )


def followup_prompt(plan_item: dict, candidate_answer: str) -> str:
    return (
        f"Topic: {plan_item['title']}.\n"
        f"Candidate's answer: \"{candidate_answer}\"\n\n"
        f"Score this answer 1-5 (1=no understanding, 5=excellent depth) "
        f"and pick ONE strategy: \"probe\" (ask why/how, same topic), "
        f"\"challenge\" (raise the stakes - scale/edge case), "
        f"\"redirect\" (move to next planned topic), "
        f"\"clarify\" (answer was vague, ask a simpler restated question).\n"
        f"Respond ONLY with JSON: {{\"score\": <1-5>, \"strategy\": \"<one of the four>\", "
        f"\"next_message\": \"<the actual follow-up question or transition text to send the candidate, 1-2 sentences>\"}}"
    )


SCORING_SYSTEM_PROMPT = PERSONA_SYSTEM_PROMPT + \
    "\nRespond ONLY with JSON as instructed. No prose, no markdown fences."


def feedback_prompt(candidate: dict, transcript: list[dict]) -> str:
    role = candidate["member"]["jobRole"]
    lines = []
    for t in transcript:
        lines.append(f"- Day {t.get('day')} [{t.get('title')}] (tier: {t.get('tier')}, score: {t.get('score')}): "
                      f"Q: {t['question']}  A: \"{t['answer']}\"")
    transcript_text = "\n".join(lines)

    return (
        f"Candidate: {role}. Interview transcript:\n{transcript_text}\n\n"
        f"Generate final feedback. You must output EXACTLY 2 strengths and "
        f"EXACTLY 2 gaps. Each one MUST include a short exact quoted snippet "
        f"(a few words, verbatim, in quotes) pulled from the candidate's own "
        f"answer text above as evidence — not a paraphrase, not generic. "
        f"If scores were broadly consistent with the candidate's original "
        f"attempt signals (e.g. first-try passes scored well), mention that "
        f"briefly in the summary.\n"
        f"Respond ONLY with JSON: {{\"summary\": \"<2-3 sentences>\", "
        f"\"strengths\": [\"<point including a verbatim quoted snippet>\", "
        f"\"<point including a verbatim quoted snippet>\"], "
        f"\"gaps\": [\"<point including a verbatim quoted snippet, with suggestion>\", "
        f"\"<point including a verbatim quoted snippet, with suggestion>\"], "
        f"\"next\": [\"<actionable review pointer>\", ...]}}"
    )


FEEDBACK_SYSTEM_PROMPT = PERSONA_SYSTEM_PROMPT + \
    "\nRespond ONLY with JSON as instructed. No prose, no markdown fences."
