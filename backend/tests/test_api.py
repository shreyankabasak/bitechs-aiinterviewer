import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

import llm
import main

client = TestClient(main.app)
CANDIDATES = json.loads((Path(__file__).parent.parent / "candidates.json").read_text())["candidates"]
LONG_ANSWER = ("I containerized the service with Docker, wrote a multi-stage build, pinned dependency "
               "versions, and verified the health endpoint before deploying to production.")


@pytest.fixture(autouse=True)
def mock_llm(monkeypatch):
    """Deterministic LLM so no test depends on a network call."""
    monkeypatch.setattr(llm, "phrase_question", lambda s, p: "MOCK QUESTION")
    monkeypatch.setattr(llm, "score_and_strategize",
                        lambda s, p: {"score": 4, "strategy": "redirect", "next_message": "Moving on."})
    monkeypatch.setattr(llm, "generate_feedback", lambda s, p: {
        "summary": "ok", "strengths": ["a"], "gaps": ["b"], "next": ["c"]})


def start(session="s1", candidate=None):
    return client.post("/api/interview", json={"sessionId": session, "candidate": candidate or CANDIDATES[0]})


def say(message, session="s1"):
    return client.post("/api/interview", json={"sessionId": session, "message": message})


# ---- classification ----
@pytest.mark.parametrize("text,expected", [
    ("I don't understand the question", "clarification"),
    ("can you repeat that", "clarification"),
    ("idk", "non_answer"),
    ("not sure about this", "non_answer"),
    ("too short", "non_answer"),
    (LONG_ANSWER, "real_answer"),
])
def test_classify_message(text, expected):
    assert main._classify_message(text) == expected


def test_resolve_candidate_full_profile_passthrough():
    assert main._resolve_candidate(CANDIDATES[0]) is CANDIDATES[0]


def test_resolve_candidate_from_role():
    cand = main._resolve_candidate({"role": "DevOps Engineer"})
    assert cand["member"]["jobRole"] == "DevOps Engineer"


# ---- health ----
def test_health_endpoint():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


# ---- starting a session ----
def test_start_returns_first_question():
    r = start()
    assert r.status_code == 200
    body = r.json()
    assert body["done"] is False
    assert body["questionNumber"] == 1
    assert body["totalQuestions"] >= 8
    assert "MOCK QUESTION" in body["reply"]


def test_start_with_role_only_payload():
    r = client.post("/api/interview", json={"sessionId": "r1", "candidate": {"role": "Backend Engineer"}})
    assert r.status_code == 200 and r.json()["done"] is False


def test_duplicate_session_rejected():
    start()
    assert start().status_code == 400


def test_candidate_with_no_missions_ends_immediately():
    r = start("empty", {"member": {"name": "Z"}, "missions": []})
    body = r.json()
    assert r.status_code == 200 and body["done"] is True and body["feedback"]["score"] == 0


# ---- input validation ----
def test_unknown_session_rejected():
    assert say("hello there", "ghost").status_code == 400


def test_missing_message_rejected():
    start()
    assert client.post("/api/interview", json={"sessionId": "s1"}).status_code == 400


def test_invalid_body_returns_422():
    assert client.post("/api/interview", json={}).status_code == 422


# ---- conversation flow ----
def test_clarification_does_not_advance_question():
    start()
    r = say("I don't understand")
    body = r.json()
    assert body["questionNumber"] == 1
    assert main.SESSIONS["s1"]["transcript"] == []


def test_non_answer_is_scored_low_and_advances():
    start()
    r = say("idk")
    assert r.json()["questionNumber"] == 2
    t = main.SESSIONS["s1"]["transcript"][0]
    assert t["score"] == 1 and t["classification"] == "non_answer"


def test_real_answer_uses_llm_score_and_transition():
    start()
    r = say(LONG_ANSWER)
    body = r.json()
    assert body["questionNumber"] == 2
    assert body["reply"].startswith("Moving on.")
    assert main.SESSIONS["s1"]["transcript"][0]["score"] == 4


def test_followup_capped_to_one_per_topic(monkeypatch):
    monkeypatch.setattr(llm, "score_and_strategize",
                        lambda s, p: {"score": 3, "strategy": "probe", "next_message": "Tell me more."})
    start()
    first = say(LONG_ANSWER).json()
    assert first["questionNumber"] == 1 and first["reply"] == "Tell me more."   # follow-up
    second = say(LONG_ANSWER).json()
    assert second["questionNumber"] == 2                                           # cap forces advance
    assert "Tell me more." not in second["reply"]                                  # no pasted follow-up


def test_full_interview_completes_with_feedback():
    start()
    body = None
    for _ in range(40):
        body = say(LONG_ANSWER).json()
        if body["done"]:
            break
    assert body["done"] is True
    fb = body["feedback"]
    assert fb["score"] == 8.0                       # avg 4/5 -> 8/10
    assert len(fb["strengths"]) == 2 and len(fb["gaps"]) == 2   # padded to exactly 2
    assert say("one more", "s1").status_code == 400  # finished session rejects input


def test_three_non_answers_cap_score_at_three():
    start()
    body = None
    for _ in range(40):
        body = say("idk").json()
        if body["done"]:
            break
    assert body["feedback"]["score"] <= 3.0


def test_unhandled_error_returns_500_json(monkeypatch):
    monkeypatch.setattr(main, "build_plan", lambda c: (_ for _ in ()).throw(RuntimeError("boom")))
    safe = TestClient(main.app, raise_server_exceptions=False)
    r = safe.post("/api/interview", json={"sessionId": "e1", "candidate": CANDIDATES[0]})
    assert r.status_code == 500 and "boom" in r.json()["detail"]
