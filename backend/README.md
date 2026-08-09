# AI Interview Agent — Backend

FastAPI backend for the Interview Agent. Deployed live at:
`https://bitechs-aiinterviewer.onrender.com`

## Quick start

```bash
pip install -r requirements.txt
export GROQ_API_KEY=gsk_...      # omit this to run in mock mode (no API calls, for testing the contract shape)
uvicorn main:app --reload --port 8000
```

Test it:

```bash
# Turn 1 - init
curl -X POST http://localhost:8000/api/interview \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"test-1","candidate": {"role": "Frontend Developer"}}'

# Turn 2+ - conversation
curl -X POST http://localhost:8000/api/interview \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"test-1","message":"I think it uses cosine similarity to compare vectors."}'
```

Or just run `python3 simulate.py` — runs a full interview against a real
candidate profile without needing a server or API key (mock mode).

## Why Groq

Google Gemini was the initial choice but was dropped after hitting two real
problems in testing: the free tier's daily quota (20 requests/model/day) was
exhausted almost immediately during integration testing, and Gemini's
"thinking" models were silently consuming the output token budget on
internal reasoning, causing responses to truncate mid-sentence. Groq's free
tier (14,400 requests/day, no credit card, no thinking-token overhead) 
solved both problems and has been stable since the switch.

## Architecture

- `planner.py` — **deterministic** question plan builder. Given a candidate,
  picks which curriculum days to ask about, spread across modules, weighted
  by mission attempts/skips. Never calls the LLM — guarantees the "8
  questions / 4 days" requirement structurally, even for a lightweight
  `{"role": "..."}` payload from the frontend (synthesizes a full spanning
  profile in that case). Run `python3 planner.py` to verify it against all
  20 real candidates.
- `llm.py` — the only file that calls the model (Groq /
  `llama-3.1-8b-instant`). Falls back to a presentable mock response if
  `GROQ_API_KEY` isn't set or a live call fails, so a transient API issue
  never crashes the interview or shows debug text to the user. Real errors
  are still logged and exposed via `/health` for debugging.
- `prompts.py` — persona voice + prompt templates.
- `models.py` — Pydantic models matching `technical-spec.md`, extended with
  a couple of optional bonus fields (`score`, `totalQuestions`,
  `questionNumber`) the frontend uses for its UI.
- `main.py` — the single `POST /api/interview` endpoint + session state
  machine (in-memory dict, keyed by `sessionId`). Also handles
  clarification-request vs non-answer vs real-answer classification, the
  follow-up cap, and the score-cap business rule (3+ non-answers caps
  readiness at 3/10).
- `simulate.py` — standalone end-to-end test, no FastAPI server needed.

## Endpoints

- `POST /api/interview` — see `technical-spec.md` and the top-level README
  for the exact contract.
- `GET /health` — liveness check. Returns `{status, mock_mode, model,
  last_llm_error}` — `last_llm_error` surfaces the most recent API failure
  (if any) without needing to dig through Render's log viewer.

## Deployment

Deployed on Render (free tier). Root directory: `backend`. Build command:
`pip install -r requirements.txt`. Start command:
`uvicorn main:app --host 0.0.0.0 --port $PORT`. `GROQ_API_KEY` set as an
environment variable on Render (not committed to the repo). Free tier
sleeps after ~15 min idle — first request after that takes 30-60s to wake.
