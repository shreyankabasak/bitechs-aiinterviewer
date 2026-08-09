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
## Day 2 — Sat 8 Aug

### [Tool: Lovable] — 8 PM

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


---------------
## Day 3 — Sun 9 Aug

### [Tool: Lovable] — 10:00 AM

**Prompt:**
Replace mockApi.ts with real calls to our backend, and remove all hardcoded references to 7 questions.

1. POST to https://bitechs-aiinterviewer.onrender.com/api/interview
2. To start a session: body {sessionId, candidate: {role}}, response {reply, done, totalQuestions, questionNumber}
3. To continue: body {sessionId, message}, same response shape
4. On done:true, response includes feedback {summary, strengths[2], gaps[2], score} — map score to the /10 display, strengths/gaps to the two quoted cards
5. Use questionNumber and totalQuestions from the response everywhere a question count is shown — the counter and progress bar should read "Question X of {totalQuestions}", not a fixed 7
6. Change the hero text "Seven questions. One honest readout." to something that doesn't hardcode a number, like "A short adaptive interview. One honest readout."
7. Keep the loading/typing indicator visible for up to 60 seconds in case the first request is slow (backend cold start), instead of timing out or erroring
8. Keep all existing UI components and styling untouched — only change the data-fetching logic and the specific text mentioned above

**What it produced:**
Live backend wired in: sessions start with {sessionId, candidate:{role}}, turns post {sessionId, message}, the counter and progress bar now read the backend's questionNumber/totalQuestions (verified "Question 1 of 9"), final feedback maps to the score and the strength/gap cards, requests wait up to 60s for cold starts, the mock engine is deleted, and the hero now reads "A short adaptive interview. One honest readout." — everything else untouched.

**Kept/modified:**
Kept all existing UI components and styling from previous fixes untouched. Replaced mockApi.ts's mock question/scoring logic entirely with real calls to the deployed backend (https://bitechs-aiinterviewer.onrender.com). Note: post-integration testing surfaced two open bugs being worked on with the backend developer — (1) a question occasionally renders truncated mid-sentence, and (2) the follow-up "Can you go a bit deeper on that?" can repeat instead of advancing after a substantive answer. Fix in progress on the backend side.**

---------------------------------------------------------------------------------------------------------

**Backend**

Day 3 — Sun 9 Aug
[Tool: Claude] — Morning
Prompt: Given these three problem statements, tell me which is easiest and best for winning this hackathon — think of it as you're the pro developer and coder and can create anything from the problem statement I gave and then guide me through each step.

What it produced: Recommendation to choose Problem 2 (Interview Agent) over Problem 1 (Redesign ABTalks — judged mostly on UI/UX polish, not our team's strength) and Problem 3 (Autonomous AI Creator — requires genuine 48-hour unattended uptime, high infra risk on a hackathon timeline). Followed by a full build plan: deterministic question planner weighted by candidate mission attempts/skips, adaptive follow-up strategy, evidence-based feedback.

Kept/modified: Adopted Problem 2 as the final choice.

[Tool: Claude] — Late morning
Prompt: Let's start the work right now — guide me through step by step for backend first, or tell me what to tell my other two teammates to do. Keep in mind: maximize efficiency in less time.

What it produced: Full FastAPI backend built from scratch — planner.py (deterministic question-plan builder spanning curriculum modules/days, weighted by attempts/skips, tested against all 20 provided candidate profiles), models.py (Pydantic models matching technical-spec.md), llm.py (LLM wrapper with mock fallback), prompts.py (persona + prompt templates), main.py (the POST /api/interview endpoint and session state machine), simulate.py (end-to-end test harness). Verified all 20 candidates produce 8+ questions across 4+ days before writing any endpoint code.

Kept/modified: Used as the initial backend, iterated on in every entry below.

Afternoon
[Tool: Claude] — Afternoon
Prompt: For the LLM piece I needed something free to work with, so I used a Gemini key instead — give the rest of the steps accordingly. Also my teammate made a web app on Lovable — here's the prompt she used, take help from this and give me the next steps.

What it produced: llm.py rewritten to call Gemini instead of the original provider. After being shown the frontend's actual handoff spec (fixed request/response shape, exactly-2 strengths/gaps, a score field, quoted-snippet requirement, non-answer/clarification-request handling, and a 7-question assumption that conflicted with the real spec's 8-question minimum), the backend was extended to: accept the frontend's lightweight {role} payload (synthesizing a full spanning candidate profile so the planner still guarantees 8+ questions/4+ days), return totalQuestions/questionNumber so the frontend's counter isn't hardcoded, add a deterministic score-cap rule (3+ non-answers caps readiness at 3/10) computed in code rather than trusted to the model, and force exactly 2 strengths/2 gaps with verbatim quoted snippets in the feedback prompt.

Kept/modified: Backend now accepts either a full candidate.json profile or a role-only payload; feedback shape extended with a bonus score field while keeping the spec's required summary/strengths/gaps/next fields intact.

Prompt: I need the backend live on Render in order to deploy the complete project to be submitted — what should be done finally, tell me the complete correct steps to fully finish and deploy the backend from my side.

What it produced: Full Render deployment walkthrough — pushing the backend into a /backend subfolder of the shared repo, creating the Render web service, setting the root directory/build/start commands, setting the API key as an environment variable, and verifying via /health and a live curl test.

Kept/modified: Backend deployed live at https://bitechs-aiinterviewer.onrender.com.

Evening — debugging the live integration
[Tool: Claude] — Evening
Prompt: (Reporting a live 500 error on /api/interview after deployment.)

What it produced: Diagnosed as an uncaught exception — added a global exception handler and wrapped the LLM call in a try/except so any API failure falls back to a mock response instead of crashing the request, and exposed the last real error via GET /health for fast debugging without digging through Render's log viewer.

Prompt: (Reporting the fallback text showing up on real requests.)

What it produced: Root cause found via the new /health error field — Gemini's free tier was hitting its daily quota, and separately its "thinking" models were consuming the output token budget on invisible internal reasoning, causing visible responses to truncate mid-sentence.

Prompt: I don't want to pay a single rupee — give me a free and reliable long-term solution so this doesn't become a weak point when judges evaluate the submission.

What it produced: Backend migrated from Gemini to Groq (llama-3.1-8b-instant) — a genuinely free-forever tier (14,400 requests/day vs. Gemini's 20/day) with no thinking-token overhead. Also rewrote the mock fallback text to read as a normal, presentable interview response instead of visible "[MOCK]"/"[ANTHROPIC_API_KEY]" debug text, so a worst-case API outage during judging would never look broken to a candidate.

Prompt: (Reporting that a follow-up question was repeating verbatim instead of advancing after a substantive answer.)

What it produced: Traced to the transition logic concatenating the model's same-topic follow-up text onto the next question whenever the follow-up cap forced an advance, even when the model's own strategy wasn't actually a "redirect." Fixed by only using that text as a transition when the strategy was genuinely "redirect."

Prompt: Retest with a fresh sessionId end to end — how?

What it produced: A 5-request test sequence (init, weak answer, strong answer, another strong answer, a clarification request) run live against the deployed backend, confirming clean single-question replies, correct question-count advancement, and correct clarification handling with no regressions.

Kept/modified: All fixes deployed and verified live before handoff to the frontend for final integration.
