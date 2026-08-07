# Interview Ace

Build a modern, high-performance web app called "Interview Agent" — 

an AI-powered mock interview coach.

### APP FLOW & SCREENS

1. LANDING / ROLE SELECTION SCREEN

   - Logo and title: "Interview Agent — AI Technical Screener"

   - Role Selector: Dropdown with preset roles (Frontend Developer, 

     Backend Developer, Product Manager, Data Analyst, Marketing, 

     Sales) plus a "Custom Role" option with a text input.

   - Brief tagline explaining what the tool does.

   - "Start Interview" CTA button.

2. INTERVIEW SCREEN

   - Top header: Progress indicator "Question X of 7".

   - Main chat UI: AI interviewer messages on the left (rendered in 

     Markdown, so code snippets format cleanly), candidate responses 

     on the right.

   - Input bar: Multi-line text input with a word counter and 

     "Submit Answer" button. Enter to send, Shift+Enter for newline.

   - Visible "Agent is thinking..." indicator while formulating the 

     next question.

3. FEEDBACK SCREEN (triggers after 7 exchanges)

   - Readiness Score card: score out of 10 with a one-line summary.

   - Strengths: exactly 2 concrete strengths, each with a short 

     quoted snippet from the candidate's actual answer.

   - Areas to Improve: exactly 2, each tied to a specific moment in 

     the interview.

   - "Start New Interview" button to reset.

### TECHNICAL & ARCHITECTURE

- Framework: React (TypeScript) with Tailwind CSS and Lucide React 

  icons.

- Component structure:

  - /components/RoleSelector.tsx

  - /components/InterviewChat.tsx

  - /components/FeedbackReport.tsx

  - /services/mockApi.ts — mock engine simulating dynamic question 

    generation and context tracking across 7 questions, so the flow 

    is fully testable before real AI is wired in.

- Data models: TypeScript types for InterviewTurn, CandidateAnswer, 

  and FeedbackSummary.

- Store conversation state in React state — no backend/database yet.

### DESIGN LANGUAGE & UI/UX

- Theme: dark modern SaaS style (Linear/Vercel aesthetic) — deep 

  void background (#09090b), subtle border highlights, sleek 

  typography, muted badges, monochromatic base with one vivid 

  accent color.

- Smooth Tailwind transitions between screens and on message 

  send/receive.

- Fully mobile responsive.

Keep the code clean and readable — I'll be extending it with real AI 

integration and additional features next.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://ai-coach-buddy-07.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/b9667a23-c9ad-4a15-8ff3-5f71a1c3dcaa).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
