/**
 * Real backend client for the Interview Agent.
 *
 * The backend keeps all session state (question plan, scoring, feedback);
 * the frontend only sends a sessionId plus either the initial candidate
 * payload or the next message, and renders whatever comes back.
 */

const ENDPOINT = "https://bitechs-aiinterviewer.onrender.com/api/interview";

/** Cold starts on the hosted backend can take a while — wait it out. */
const REQUEST_TIMEOUT_MS = 60_000;

export interface ApiFeedback {
  summary: string;
  strengths: string[];
  gaps: string[];
  next?: string[];
  score?: number | null;
}

export interface InterviewApiResponse {
  reply: string;
  done: boolean;
  feedback?: ApiFeedback | null;
  totalQuestions?: number | null;
  questionNumber?: number | null;
}

async function post(body: Record<string, unknown>): Promise<InterviewApiResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`Interview backend responded with ${res.status}`);
    }
    return (await res.json()) as InterviewApiResponse;
  } finally {
    clearTimeout(timer);
  }
}

export function newSessionId(): string {
  return `sess-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** First turn: hands the backend the selected role and gets the opener back. */
export function startSession(sessionId: string, role: string) {
  return post({ sessionId, candidate: { role } });
}

/** Every turn after the first. */
export function sendMessage(sessionId: string, message: string) {
  return post({ sessionId, message });
}
