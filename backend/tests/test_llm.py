import json

import llm


def test_mock_mode_is_active_without_api_key():
    assert llm._USE_MOCK is True


def test_score_parses_fenced_json(monkeypatch):
    monkeypatch.setattr(llm, "_call", lambda *a, **k: '```json\n{"score": 5, "strategy": "challenge"}\n```')
    assert llm.score_and_strategize("sys", "p") == {"score": 5, "strategy": "challenge"}


def test_score_falls_back_on_bad_json(monkeypatch):
    monkeypatch.setattr(llm, "_call", lambda *a, **k: "not json at all")
    assert llm.score_and_strategize("sys", "p") == {"score": 3, "strategy": "redirect"}
    assert "parse failed" in llm.LAST_ERROR


def test_feedback_falls_back_on_bad_json(monkeypatch):
    monkeypatch.setattr(llm, "_call", lambda *a, **k: "oops")
    fb = llm.generate_feedback("sys", "p")
    assert fb["summary"] == "Interview completed."


def test_mock_feedback_shape():
    out = json.loads(llm._mock_response('{"summary": ...}'))
    assert set(out) == {"summary", "strengths", "gaps", "next"}


def test_mock_score_shape():
    out = json.loads(llm._mock_response('{"score": ...}'))
    assert out["strategy"] == "redirect"
