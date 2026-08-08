"""
LLM wrapper. This is the ONLY file that makes API calls.

Uses Google Gemini (free tier available). Set GEMINI_API_KEY as an
environment variable before running. If it's not set, every function
falls back to a deterministic mock so the rest of the app (state
machine, contract shape) is testable without a key.
"""

import os
import json

MODEL = os.environ.get("LLM_MODEL", "gemini-2.5-flash")
_USE_MOCK = not os.environ.get("GEMINI_API_KEY")

if not _USE_MOCK:
    import google.generativeai as genai
    genai.configure(api_key=os.environ["GEMINI_API_KEY"])
    _client = genai.GenerativeModel(MODEL)


def _call(system: str, user: str, max_tokens: int = 500) -> str:
    if _USE_MOCK:
        return _mock_response(user)
    # Gemini doesn't have a separate "system" param on the basic
    # GenerativeModel call the way Anthropic does — prepend it to the
    # prompt instead. Works fine in practice for this use case.
    full_prompt = f"{system}\n\n{user}"
    resp = _client.generate_content(
        full_prompt,
        generation_config={"max_output_tokens": max_tokens},
    )
    return resp.text


def _mock_response(user: str) -> str:
    """Deterministic stand-in so main.py/planner.py are testable with
    no API key. Swap out once GEMINI_API_KEY is set — nothing else
    needs to change."""
    if '"summary"' in user:
        return json.dumps({
            "summary": "[MOCK] Candidate showed solid grasp of core topics with some gaps in advanced areas.",
            "strengths": ["[MOCK] Strong on embeddings fundamentals (Day 7)"],
            "gaps": ["[MOCK] Could go deeper on deployment tradeoffs (Day 28)"],
            "next": ["[MOCK] Review Docker/Kubernetes deployment day"],
        })
    if '"score"' in user:
        return json.dumps({"score": 3, "strategy": "redirect",
                            "next_message": "[MOCK] Let's move to the next topic."})
    return f"[MOCK REPLY] (no ANTHROPIC_API_KEY set) — would respond to: {user[:80]}..."


def phrase_question(system_prompt: str, prompt: str) -> str:
    return _call(system_prompt, prompt, max_tokens=300).strip()


def score_and_strategize(system_prompt: str, prompt: str) -> dict:
    raw = _call(system_prompt, prompt, max_tokens=200)
    try:
        # strip stray markdown fences if the model adds them
        cleaned = raw.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
        return json.loads(cleaned)
    except Exception:
        return {"score": 3, "strategy": "probe"}  # safe default, never crash the interview


def generate_feedback(system_prompt: str, prompt: str) -> dict:
    raw = _call(system_prompt, prompt, max_tokens=800)
    try:
        cleaned = raw.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
        return json.loads(cleaned)
    except Exception:
        return {
            "summary": "Interview completed.",
            "strengths": [],
            "gaps": [],
            "next": [],
        }
