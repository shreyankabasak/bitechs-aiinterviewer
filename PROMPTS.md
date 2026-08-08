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
## Day 3 — Sun 9 Aug

### [Tool: Lovable] — (add timestamp)

**Prompt:**
Fix these issues in the Interview Agent app. Keep the existing scoring logic (non-answer detection, score capping, clarification-request handling) and question randomization from previous fixes completely intact — none of this should touch mockApi.ts's scoring rules, only the items below.

#### CORE FIXES

1. Code snippet blocks (in the "Quick code read" / code reasoning question) are overflowing horizontally on mobile and text is getting cut off. Make code blocks wrap or scroll cleanly within their container, with proper padding, on all screen sizes from 320px up.
2. The chat message feed is being clipped/overlapped by the fixed bottom input bar. Add sufficient bottom padding/margin to the scrollable message container so the last message is never hidden behind the input, on all screen sizes.
3. Verify the "Question X of 7" counter updates in sync with the question actually rendered on screen — it should never show a number ahead of the visible question content.
4. Add a visible progress bar (not just "Question X of 7" text) so users can see how much of the interview remains.
5. Add graceful error handling: if the AI scoring/response call fails, show a retry option instead of a silent failure or infinite loading state.
6. Add basic input validation: disable "Submit Answer" until there's meaningful text (e.g. more than a few characters), and show a subtle warning if a user tries to submit empty.

#### HACKATHON POLISH

- Add a visible "regenerate question" or "skip" option in case a question doesn't apply to the user's background.
- Add a shareable results screen (readiness score + strengths/gaps) with a "copy summary" or "download as image" button, since this will likely be demoed live.
- Add a subtle loading/typing indicator while the AI is generating the next question, so it doesn't look frozen during the demo.
- Make sure the final report clearly cites the specific answer text it's scoring against, since that's the app's core differentiator.

**Screenshots provided (issues being fixed):**
<img width="365" height="346" alt="screenshot-agent" src="https://github.com/user-attachments/assets/d752de72-c342-413d-a6d2-48f83d12a4e0" />


**What it produced:** All fixes verified end-to-end at 320px — code blocks now scroll instead of overflowing, the message feed clears the fixed input bar with proper bottom padding, the question counter and progress bar stay in sync with the visible question, and skip/retry plus 10-character input validation are working. The feedback report now cites the exact answer text each point scores against, and a copy-summary / download-as-image sharing option was added to the results screen.

**Kept/modified:** Preserved all existing scoring logic in mockApi.ts (non-answer detection, score capping, clarification-request handling) and question randomization untouched. Modified only the UI/UX layer — chat container styling, progress indicator, input validation, error/retry states, and the results screen — plus added the shareable summary/export feature.
