from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from models import InterviewRequest, InterviewResponse
from planner import build_plan
import llm
import prompts

app = FastAPI(title="AI Interview Agent")

# Wide open CORS since there's no auth and judges may hit this from
# anywhere (their own test page, curl, etc.)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# sessionId -> session state. In-memory is explicitly fine per the
# spec (no persistent accounts required). Lost on restart, which is
# an acceptable tradeoff for a hackathon-window deployment.
SESSIONS: dict[str, dict] = {}

FOLLOWUP_CAP = 2  # max extra follow-ups on a single topic before we move on regardless


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


def _build_feedback(session: dict) -> dict:
    prompt = prompts.feedback_prompt(session["candidate"], session["transcript"])
    return llm.generate_feedback(prompts.FEEDBACK_SYSTEM_PROMPT, prompt)


@app.post("/api/interview", response_model=InterviewResponse)
def interview(req: InterviewRequest):
    # --- Turn 1: initialize a new session ---
    if req.candidate is not None:
        if req.sessionId in SESSIONS:
            raise HTTPException(400, "sessionId already initialized")
        session = _new_session(req.candidate)
        SESSIONS[req.sessionId] = session

        if not session["plan"]:
            # degenerate candidate with no usable missions at all
            feedback = {"summary": "No mission data available to conduct an interview.",
                        "strengths": [], "gaps": [], "next": []}
            session["done"] = True
            return InterviewResponse(reply="We weren't able to find enough completed material to interview on.",
                                      done=True, feedback=feedback)

        name = session["candidate"].get("member", {}).get("name", "there")
        opener = f"Welcome, {name}. Let's begin — I'll ask about your work across the cohort."
        question = _ask_current_question(session)
        return InterviewResponse(reply=f"{opener}\n\n{question}", done=False)

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
        "score": score, "strategy": strategy,
    })

    # Decide whether to stay on this topic or move to the next planned one
    stay_on_topic = strategy in ("probe", "challenge", "clarify") and \
        session["followups_on_current"] < FOLLOWUP_CAP

    if stay_on_topic:
        session["followups_on_current"] += 1
        session["_pending_question"] = followup_text or "Can you go a bit deeper on that?"
        return InterviewResponse(reply=session["_pending_question"], done=False)

    # Move to the next planned question
    _advance(session)
    next_item = _current_item(session)

    if next_item is None:
        # Interview complete
        session["done"] = True
        feedback = _build_feedback(session)
        return InterviewResponse(reply="Interview completed.", done=True, feedback=feedback)

    transition = (followup_text + " ") if followup_text else ""
    next_question = _ask_current_question(session)
    return InterviewResponse(reply=f"{transition}{next_question}".strip(), done=False)


@app.get("/health")
def health():
    return {"status": "ok", "mock_mode": llm._USE_MOCK}
