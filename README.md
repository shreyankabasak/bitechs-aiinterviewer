# Interview Agent

An AI-powered mock interview coach built for the ABTalks Vibe Code Hackathon (Problem Statement 2) by Team BITECHS.

A live, adaptive mock interview: pick a role, answer real technical and behavioral questions from an AI interviewer, and get back a scored readiness report with feedback quoted directly from your own answers.

**Live app:** https://ai-coach-buddy-07.lovable.app
**Full AI-assisted build log:** [PROMPTS.md](./PROMPTS.md)

## What it does

- **Role selection** — pick a preset role (Frontend Developer, Backend Developer, Product Manager, Data Analyst, Marketing, Sales) or enter a custom one.
- **Adaptive interview** — a multi-question, conversational screen covering warm-up, core technical, problem-solving, behavioral, trade-off, and closing questions, spanning multiple curriculum areas. Follow-up questions reference what you actually said in earlier answers.
- **Scored feedback report** — a readiness score out of 10, exactly two strengths and two areas to improve, each backed by a real quoted snippet from your own responses — not generic praise.

Along the way, the app also:
- Detects the difference between a genuine answer, a "not sure" non-answer, and a request for clarification — and responds to each differently instead of scoring them the same
- Lets you skip a question that doesn't fit your background
- Shows a live progress bar and typing indicator
- Offers a shareable summary of your results

## Architecture

**Frontend** — React (TypeScript) + Tailwind CSS + Lucide icons, built and iterated in Lovable, dark Linear/Vercel-style UI. Hosted at the Lovable-published URL above.

**Backend** — Python (FastAPI), deployed on Render, powering real question generation and scoring via the **Groq API** (`llama-3.1-8b-instant`). Google Gemini was the initial choice but was dropped after hitting daily free-tier quota limits and token-budget/truncation issues during testing; Groq replaced it for the live backend — chosen for its generous free tier (14,400 requests/day) and reliable, fast responses.

The frontend talks to the backend over a simple REST contract:

- `POST /api/interview` — start a session: `{sessionId, candidate: {role}}` → `{reply, done, totalQuestions, questionNumber}`
- `POST /api/interview` — continue: `{sessionId, message}` → same shape, or `{done: true, feedback: {summary, strengths[2], gaps[2], score}}` on the final turn
- `GET /health` — liveness check

Backend repo path: [`/backend`](./backend) in this repository — see [`/backend/README.md`](./backend/README.md) for backend-specific setup and architecture notes.

**Note:** Render's free tier sleeps after ~15 minutes idle, so the first request after a period of inactivity can take 30–60 seconds to wake up — the frontend's loading indicator accounts for this.

## AI tools used in building this

This project was built through iterative, AI-assisted development across the whole stack:

- **Lovable** — generated and iterated the entire frontend (React/TypeScript/Tailwind), from the initial build through several rounds of bug fixes, UI polish, and backend integration, prompted throughout the hackathon window.
- **Claude (Anthropic)** — used for planning the app spec before the first Lovable prompt, writing and refining every subsequent Lovable prompt, designing and building the FastAPI backend (question planning logic, session state machine, prompt design), debugging deployment and integration issues (GitHub/Render setup, provider migration from Gemini to Groq), and diagnosing/fixing bugs found during live testing (truncated responses, a follow-up loop, and a transition-text bug).
- **Groq** — powers the live backend: real-time interview question generation and response scoring, called from the FastAPI backend via `llama-3.1-8b-instant`.
- **ChatGPT** — used to independently test and verify the app's scoring behavior across different assigned roles, checking that questions and readiness scores were working correctly for each.

The full prompt-by-prompt log — every prompt sent, what it produced, and what was kept or modified — is in [PROMPTS.md](./PROMPTS.md) at the repo root.

## Deployment

- **Frontend:** published via Lovable at https://ai-coach-buddy-07.lovable.app, two-way synced to this GitHub repo — every Lovable prompt commits directly to `main`.
- **Backend:** deployed on Render at `/backend`, with the Groq API key set as an environment variable (not committed to the repo).

## Local development

```bash
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

Requires Node.js and npm (install with [nvm](https://github.com/nvm-sh/nvm)). The backend has its own setup — see [`/backend/README.md`](./backend/README.md).

## Team

BITECHS — ABTalks Vibe Code Hackathon, Problem Statement 2.
