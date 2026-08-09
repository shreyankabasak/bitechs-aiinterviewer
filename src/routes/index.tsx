import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useRef, useState } from "react";
import { RoleSelector } from "@/components/RoleSelector";
import { InterviewChat } from "@/components/InterviewChat";
import { FeedbackReport } from "@/components/FeedbackReport";
import {
  newSessionId,
  sendMessage,
  startSession,
  type ApiFeedback,
  type InterviewApiResponse,
} from "@/services/interviewApi";
import type { ChatMessage, FeedbackPoint, FeedbackSummary } from "@/types/interview";

const title = "Interview Agent — AI Technical Screener";
const description =
  "Run a short adaptive mock interview for engineering, product, data, marketing and sales roles, then get a scored readiness report.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

type Stage = "select" | "interview" | "feedback";

/** What the agent was doing when a call failed, so retry can repeat it. */
type PendingTask = { kind: "start"; role: string } | { kind: "message"; message: string };

const rid = () => Math.random().toString(36).slice(2, 10);

function toPoints(items: string[] | undefined): FeedbackPoint[] {
  return (items ?? [])
    .filter((t) => typeof t === "string" && t.trim().length > 0)
    .map((text) => ({ title: text.trim() }));
}

function mapFeedback(role: string, fb: ApiFeedback): FeedbackSummary {
  const strengths = toPoints(fb.strengths);
  const summary: FeedbackSummary = {
    role,
    score: typeof fb.score === "number" ? fb.score : 0,
    summary: fb.summary || "Interview complete.",
    strengths,
    improvements: toPoints(fb.gaps),
  };
  if (strengths.length === 0) {
    summary.strengthsNote =
      "Not enough substantive answers this round to identify clear strengths.";
  }
  return summary;
}


function Index() {
  const [stage, setStage] = useState<Stage>("select");
  const [role, setRole] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [questionNumber, setQuestionNumber] = useState(1);
  const [totalQuestions, setTotalQuestions] = useState<number | null>(null);
  const [isThinking, setIsThinking] = useState(false);
  const [thinkingLabel, setThinkingLabel] = useState("Agent is thinking…");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingTask | null>(null);
  const [feedback, setFeedback] = useState<FeedbackSummary | null>(null);

  const sessionId = useRef<string>(newSessionId());

  /** Renders a backend turn: either the next question or the final report. */
  const applyResponse = useCallback((forRole: string, data: InterviewApiResponse) => {
    if (typeof data.totalQuestions === "number" && data.totalQuestions > 0) {
      setTotalQuestions(data.totalQuestions);
    }
    if (typeof data.questionNumber === "number" && data.questionNumber > 0) {
      setQuestionNumber(data.questionNumber);
    }

    if (data.done) {
      if (data.feedback) {
        setFeedback(mapFeedback(forRole, data.feedback));
        setStage("feedback");
        return;
      }
    }

    if (data.reply?.trim()) {
      setMessages((prev) => [
        ...prev,
        {
          kind: "question",
          turn: {
            id: rid(),
            index: typeof data.questionNumber === "number" ? data.questionNumber : prev.length + 1,
            question: data.reply,
            topic: data.done ? "Wrap-up" : forRole,
            askedAt: Date.now(),
          },
        },
      ]);
    }
  }, []);

  const runStart = useCallback(
    async (forRole: string) => {
      setError(null);
      setPending(null);
      setThinkingLabel("Agent is warming up your interview…");
      setIsThinking(true);
      try {
        const data = await startSession(sessionId.current, forRole);
        applyResponse(forRole, data);
      } catch {
        setPending({ kind: "start", role: forRole });
        setError("The agent couldn't start this interview. It may still be waking up.");
      } finally {
        setIsThinking(false);
      }
    },
    [applyResponse],
  );

  const runMessage = useCallback(
    async (message: string) => {
      setError(null);
      setPending(null);
      setThinkingLabel("Agent is thinking…");
      setIsThinking(true);
      try {
        const data = await sendMessage(sessionId.current, message);
        applyResponse(role, data);
      } catch {
        setPending({ kind: "message", message });
        setError("The agent couldn't process that answer.");
      } finally {
        setIsThinking(false);
      }
    },
    [applyResponse, role],
  );

  const start = (nextRole: string) => {
    sessionId.current = newSessionId();
    setRole(nextRole);
    setMessages([]);
    setQuestionNumber(1);
    setTotalQuestions(null);
    setFeedback(null);
    setError(null);
    setPending(null);
    setStage("interview");
    void runStart(nextRole);
  };

  const submitAnswer = (text: string) => {
    setMessages((prev) => [
      ...prev,
      {
        kind: "answer",
        answer: {
          id: rid(),
          turnId: [...prev].reverse().find((m) => m.kind === "question")?.turn.id ?? "",
          text,
          wordCount: text.trim().split(/\s+/).filter(Boolean).length,
          answeredAt: Date.now(),
        },
      },
    ]);
    void runMessage(text);
  };

  /** The backend owns the plan, so "skip" is just telling it to move on. */
  const skipQuestion = () => {
    if (isThinking) return;
    void runMessage("I'd like to skip this question and move to the next one.");
  };

  const retry = () => {
    if (!pending) return;
    if (pending.kind === "start") void runStart(pending.role);
    else void runMessage(pending.message);
  };

  if (stage === "select") return <RoleSelector onStart={start} />;

  if (stage === "feedback" && feedback)
    return <FeedbackReport feedback={feedback} onRestart={() => setStage("select")} />;

  return (
    <InterviewChat
      role={role}
      messages={messages}
      questionNumber={questionNumber}
      totalQuestions={totalQuestions}
      isThinking={isThinking}
      thinkingLabel={thinkingLabel}
      error={error}
      onRetry={retry}
      onSkip={skipQuestion}
      canSkip={messages.at(-1)?.kind === "question"}
      onSubmitAnswer={submitAnswer}
    />
  );
}
