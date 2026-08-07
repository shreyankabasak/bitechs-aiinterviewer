# PROMPTS.md — Interview Agent

This document records the AI-assisted development process used while building "Interview Agent" — an AI-powered mock interview coach — for the ABTalks Vibe Code Hackathon.

## AI Tools Used

- Lovable

## Day 1 — Fri 7 Aug

### [Tool: Lovable] — 10:53 PM

**Prompt:**
Build a modern, high-performance web app called "Interview Agent" — an AI-powered mock interview coach.

### APP FLOW & SCREENS
1. LANDING / ROLE SELECTION SCREEN
   - Logo and title: "Interview Agent — AI Technical Screener"
   - Role Selector: Dropdown with preset roles (Frontend Developer, Backend Developer, Product Manager, Data Analyst, Marketing, Sales) plus a "Custom Role" option with a text input.
   - Brief tagline explaining what the tool does.
   - "Start Interview" CTA button.
2. INTERVIEW SCREEN
   - Top header: Progress indicator "Question X of 7".
   - Main chat UI: AI interviewer messages on the left (rendered in Markdown, so code snippets format cleanly), candidate responses on the right.
   - Input bar: Multi-line text input with a word counter and "Submit Answer" button. Enter to send, Shift+Enter for newline.
   - Visible "Agent is thinking..." indicator while formulating the next question.
3. FEEDBACK SCREEN (triggers after 7 exchanges)
   - Readiness Score card: score out of 10 with a one-line summary.
   - Strengths: exactly 2 concrete strengths, each with a short quoted snippet from the candidate's actual answer.
   - Areas to Improve: exactly 2, each tied to a specific moment in the interview.
   - "Start New Interview" button to reset.

### TECHNICAL & ARCHITECTURE
- Framework: React (TypeScript) with Tailwind CSS and Lucide React icons.
- Component structure:
  - /components/RoleSelector.tsx
  - /components/InterviewChat.tsx
  - /components/FeedbackReport.tsx
  - /services/mockApi.ts — mock engine simulating dynamic question generation and context tracking across 7 questions, so the flow is fully testable before real AI is wired in.
- Data models: TypeScript types for InterviewTurn, CandidateAnswer, and FeedbackSummary.
- Store conversation state in React state — no backend/database yet.

### DESIGN LANGUAGE & UI/UX
- Theme: dark modern SaaS style (Linear/Vercel aesthetic) — deep void background (#09090b), subtle border highlights, sleek typography, muted badges, monochromatic base with one vivid accent color.
- Smooth Tailwind transitions between screens and on message send/receive.
- Fully mobile responsive.

Keep the code clean and readable — I'll be extending it with real AI integration and additional features next.

**What it produced:**
Full end-to-end flow — landing/role selection screen, 7-question adaptive interview chat with Markdown/code rendering and context-aware follow-up questions, and a scored feedback report (readiness score, 2 strengths with quotes, 2 areas to improve), all in the dark Linear/Vercel-style theme with a signal-green accent.

**Kept/modified:**
Kept as the base for the app. Follow-up prompts refine the scoring logic and question variety (see next entries).

---


## Day 2 — Sat 8 Aug

### [Tool: Lovable] — 12:00 AM

**Prompt:**
Fix three issues in the interview engine (`mockApi.ts`). Keep the existing component structure, styling, and context-tracking behavior (where follow-up questions reference the candidate's previous answers) completely untouched — these are logic-only fixes inside the mock engine.

### RESPONSE HANDLING

1. DETECT AND HANDLE THREE TYPES OF RESPONSES DIFFERENTLY

   * Before scoring any response, classify it into one of three categories:

     * Clarification Request — the candidate doesn't understand the question itself.
     * Non-Answer — the candidate understands the question but doesn't know the answer, or gives a very short response with no meaningful technical content.
     * Real Answer — a substantive attempt at answering, whether strong or weak.
   * Clarification requests should not be scored, should not advance the "Question X of 7" counter, and should instead trigger a simpler rephrased version of the same question. Allow one clarification retry per question before continuing.
   * Non-answers should count toward the seven interview questions, advance the counter normally, and receive an individual score of 0–2/10.
   * Real answers should continue to be scored based on relevance, specificity, and technical depth.

2. FIX OVERLY GENEROUS SCORING

   * If three or more of the seven scored responses are non-answers, cap the overall readiness score at 3/10.
   * Never use non-answers as evidence in the Strengths section. If there are fewer than two substantive answers, display a message stating there were not enough meaningful responses to identify strengths.
   * Areas to Improve should explicitly reference non-answers by topic and encourage providing reasoning instead of leaving questions unanswered.

3. FIX QUESTIONS REPEATING ACROSS SESSIONS

   * Replace fixed question ordering with randomized pools containing at least 3–4 variants for each interview stage:

     * Warm-up
     * Core Technical (2)
     * Problem-solving / Scenario
     * Behavioral
     * Trade-off / Judgment
     * Closing
   * Ensure the same seven-question set is never repeated consecutively for the same role, even after a full page refresh.
   * Preserve the existing adaptive follow-up behavior based on the candidate's previous responses.

**What it produced:**
A more robust interview engine with intelligent response classification, clarification handling, stricter readiness scoring, stronger feedback generation, and randomized question selection while preserving the existing adaptive interview experience.

**Kept/modified:**
Kept the existing UI, component structure, styling, and context-aware follow-up behavior unchanged. Modified only the interview engine logic to improve response handling, scoring accuracy, feedback quality, and question variety.

---
