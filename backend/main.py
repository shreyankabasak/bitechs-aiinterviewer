from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from models import InterviewRequest, InterviewResponse
from planner import build_plan, synthesize_candidate_from_role
import llm
import prompts

app = FastAPI(title="AI Interview Agent")

# Wide open CORS - covers the Lovable frontend domain, localhost for
# testing, and judges hitting this from wherever they test from.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

SESSIONS: dict[str, dict] = {}

FOLLOWUP_CAP = 2

# Phrases that mark a message as a clarification REQUEST (doesn't
# advance the question, doesn't count as an answer) vs a genuine but
# weak NON-ANSWER (counts as an answer, scored low). Matches the
# frontend's existing mockApi.ts behavior so real backend behaves the
# same way the team already tested and trusted.
_CLARIFY_PHRASES = ["don't understand", "dont understand", "can you repeat",
                     "what do you mean", "confused", "rephrase", "explain again"]
_NON_ANSWER_PHRASES = ["not sure", "i don't know", "i dont know", "no idea", "idk"]
_NON_ANSWER_WORD_LIMIT = 15


def _classify_message(message: str) -> str:
    text = message.lower().strip()
    if any(p in text for p in _CLARIFY_PHRASES):
        return "clarification"
    if any(p in text for p in _NON_ANSWER_PHRASES) or len(text.split()) < _NON_ANSWER_WORD_LIMIT:
        return "non_answer"
    return "real_answer"


def _resolve_candidate(payload: dict) -> dict:
    """Accepts either a full candidate.json-shaped profile OR the
    frontend's lightweight {"role": "..."} selection."""
    if "missions" in payload and "member" in payload:
        return payload
    role = payload.get("role") or payload.get("jobRole") or "Software Engineer"
    return synthesize_candidate_from_role(role)


def _new_session(candidate: dict) -> dict:
    plan = build_plan(candidate)
    return {
        "candidate": candidate,
        "plan": plan,
        "idx": 0,
        "followups_on_current": 0,
        "transcript": [],
        "done": False,
    }


def _current_item(session: dict) -> dict | None:
    if session["idx"] >= len(session["plan"]):
        return None
    return session["plan"][session["idx"]]


def _ask_current_question(session: dict) -> str:
    item = _current_item(session)
    prompt = prompts.question_prompt(session["candidate"], item)
    question = llm.phrase_question(prompts.PERSONA_SYSTEM_PROMPT, prompt)
    session["_pending_item"] = item
    session["_pending_question"] = question
    return question


def _advance(session: dict):
    session["idx"] += 1
    session["followups_on_current"] = 0


def _core_question_count(session: dict) -> int:
    return len([p for p in session["plan"] if p["kind"] in ("core", "crosslink", "skip_probe")])


def _build_feedback(session: dict) -> dict:
    prompt = prompts.feedback_prompt(session["candidate"], session["transcript"])
    fb = llm.generate_feedback(prompts.FEEDBACK_SYSTEM_PROMPT, prompt)

    # Deterministic score + cap rule, computed in code rather than
    # trusted to the LLM - matches the exact business rule the
    # frontend's mock already implements and the team tested:
    # 3+ non-answers caps overall readiness at 3/10.
    scores = [t["score"] for t in session["transcript"] if isinstance(t.get("score"), (int, float))]
    non_answer_count = sum(1 for t in session["transcript"] if t.get("classification") == "non_answer")
    if scores:
        avg_out_of_10 = (sum(scores) / len(scores)) * 2  # our scale is 1-5, frontend wants /10
    else:
        avg_out_of_10 = 5.0
    final_score = min(avg_out_of_10, 3.0) if non_answer_count >= 3 else avg_out_of_10
    fb["score"] = round(final_score, 1)

    # Frontend expects exactly 2 strengths / 2 gaps - trim or pad
    # defensively so a stray LLM output never breaks the UI.
    fb["strengths"] = (fb.get("strengths") or ["Completed the interview."])[:2]
    while len(fb["strengths"]) < 2:
        fb["strengths"].append("Engaged with each topic asked.")
    fb["gaps"] = (fb.get("gaps") or ["No major gaps identified."])[:2]
    while len(fb["gaps"]) < 2:
        fb["gaps"].append("Consider reviewing weaker-scoring topics.")
    fb.setdefault("next", [])
    return fb


@app.post("/api/interview", response_model=InterviewResponse)
def interview(req: InterviewRequest):
    # --- Turn 1: initialize a new session ---
    if req.candidate is not None:
        if req.sessionId in SESSIONS:
            raise HTTPException(400, "sessionId already initialized")
        candidate = _resolve_candidate(req.candidate)
        session = _new_session(candidate)
        SESSIONS[req.sessionId] = session
        total = _core_question_count(session)

        if not session["plan"]:
            feedback = {"summary": "No mission data available to conduct an interview.",
                        "strengths": ["N/A", "N/A"], "gaps": ["N/A", "N/A"], "next": [], "score": 0}
            session["done"] = True
            return InterviewResponse(reply="We weren't able to find enough completed material to interview on.",
                                      done=True, feedback=feedback)

        name = session["candidate"].get("member", {}).get("name", "there")
        opener = f"Welcome, {name}. Let's begin — I'll ask about your work across the cohort."
        question = _ask_current_question(session)
        return InterviewResponse(reply=f"{opener}\n\n{question}", done=False,
                                  totalQuestions=total, questionNumber=1)

    # --- Turn 2+: conversational turn ---
    session = SESSIONS.get(req.sessionId)
    if session is None:
        raise HTTPException(400, "Unknown sessionId. Call with a `candidate` payload first.")
    if session["done"]:
        raise HTTPException(400, "Interview already complete for this sessionId.")
    if not req.message:
        raise HTTPException(400, "Missing `message` field.")

    item = session.get("_pending_item")
    question_text = session.get("_pending_question", "")
    total = _core_question_count(session)

    classification = _classify_message(req.message)

    if classification == "clarification":
        # Doesn't count as an answer, doesn't advance the plan - just
        # ask the model to rephrase the SAME question more simply.
        rephrase_prompt = (f"The candidate didn't understand this question: \"{question_text}\". "
                            f"Rephrase it more simply, same topic, 1-2 sentences.")
        new_question = llm.phrase_question(prompts.PERSONA_SYSTEM_PROMPT, rephrase_prompt)
        session["_pending_question"] = new_question
        return InterviewResponse(reply=new_question, done=False,
                                  totalQuestions=total, questionNumber=session["idx"] + 1)

    if classification == "non_answer":
        # Counts as an answer, scored low, but we still move forward
        # rather than get stuck (matches frontend's tested behavior).
        score, strategy, followup_text = 1, "redirect", ""
    else:
        score_result = llm.score_and_strategize(
            prompts.SCORING_SYSTEM_PROMPT,
            prompts.followup_prompt(item, req.message),
        )
        score = score_result.get("score", 3)
        strategy = score_result.get("strategy", "redirect")
        followup_text = score_result.get("next_message", "")

    session["transcript"].append({
        "day": item.get("day"), "title": item.get("title"), "tier": item.get("tier"),
        "question": question_text, "answer": req.message,
        "score": score, "strategy": strategy, "classification": classification,
    })

    stay_on_topic = strategy in ("probe", "challenge", "clarify") and \
        classification == "real_answer" and \
        session["followups_on_current"] < FOLLOWUP_CAP

    if stay_on_topic:
        session["followups_on_current"] += 1
        session["_pending_question"] = followup_text or "Can you go a bit deeper on that?"
        return InterviewResponse(reply=session["_pending_question"], done=False,
                                  totalQuestions=total, questionNumber=session["idx"] + 1)

    _advance(session)
    next_item = _current_item(session)

    if next_item is None:
        session["done"] = True
        feedback = _build_feedback(session)
        return InterviewResponse(reply="Interview completed.", done=True, feedback=feedback,
                                  totalQuestions=total, questionNumber=total)

    transition = (followup_text + " ") if followup_text else ""
    next_question = _ask_current_question(session)
    return InterviewResponse(reply=f"{transition}{next_question}".strip(), done=False,
                              totalQuestions=total, questionNumber=session["idx"] + 1)


@app.get("/health")
def health():
    return {"status": "ok", "mock_mode": llm._USE_MOCK, "model": llm.MODEL}
