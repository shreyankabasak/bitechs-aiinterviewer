"""
LLM wrapper. This is the ONLY file that makes API calls.

Uses Google's current Gen AI SDK (google-genai package - the old
google-generativeai package is deprecated and unreliable). Set
GEMINI_API_KEY as an environment variable before running. If it's not
set, every function falls back to a deterministic mock.
"""

import os
import json
import sys
import traceback

MODEL = os.environ.get("LLM_MODEL", "gemini-flash-latest")
_USE_MOCK = not os.environ.get("GEMINI_API_KEY")
LAST_ERROR = None   # exposed via /health so we can see failures without digging through logs

if not _USE_MOCK:
    from google import genai
    from google.genai import types
    _client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])


def _call(system: str, user: str, max_tokens: int = 500) -> str:
    global LAST_ERROR
    if _USE_MOCK:
        return _mock_response(user)
    try:
        full_prompt = f"{system}\n\n{user}"
        resp = _client.models.generate_content(
            model=MODEL,
            contents=full_prompt,
            config=types.GenerateContentConfig(
                max_output_tokens=max_tokens,
                # gemini-flash-latest is a "thinking" model - it spends
                # part of max_output_tokens on invisible internal
                # reasoning before writing the visible answer. Without
                # this, short max_tokens budgets get consumed entirely
                # by thinking, and the actual reply comes back empty
                # or truncated mid-sentence. Not needed for this task.
                thinking_config=types.ThinkingConfig(thinking_budget=0),
            ),
        )
        if not resp.text:
            raise ValueError(f"Empty response from Gemini (finish_reason may indicate why): {resp}")
        return resp.text
    except Exception as e:
        # NEVER let a live demo hard-crash because of an API hiccup -
        # log the real error (visible in Render logs + /health) and
        # fall back to mock text so the interview keeps running.
        LAST_ERROR = f"{type(e).__name__}: {e}"
        print(f"[llm.py] Gemini call failed, falling back to mock: {LAST_ERROR}", file=sys.stderr)
        traceback.print_exc()
        return _mock_response(user)


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
    return f"[MOCK REPLY] (Gemini call failed or GEMINI_API_KEY not set) — would respond to: {user[:80]}..."


def phrase_question(system_prompt: str, prompt: str) -> str:
    return _call(system_prompt, prompt, max_tokens=600).strip()


def score_and_strategize(system_prompt: str, prompt: str) -> dict:
    global LAST_ERROR
    raw = _call(system_prompt, prompt, max_tokens=500)
    try:
        cleaned = raw.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
        return json.loads(cleaned)
    except Exception as e:
        LAST_ERROR = f"score_and_strategize JSON parse failed: {e} | raw={raw[:200]!r}"
        print(f"[llm.py] {LAST_ERROR}", file=sys.stderr)
        return {"score": 3, "strategy": "redirect"}  # redirect, not probe - never get stuck on parse failure


def generate_feedback(system_prompt: str, prompt: str) -> dict:
    global LAST_ERROR
    raw = _call(system_prompt, prompt, max_tokens=1200)
    try:
        cleaned = raw.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
        return json.loads(cleaned)
    except Exception as e:
        LAST_ERROR = f"generate_feedback JSON parse failed: {e} | raw={raw[:200]!r}"
        print(f"[llm.py] {LAST_ERROR}", file=sys.stderr)
        return {
            "summary": "Interview completed.",
            "strengths": [],
            "gaps": [],
            "next": [],
        }
