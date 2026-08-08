import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RoleSelector } from "@/components/RoleSelector";
import { InterviewChat } from "@/components/InterviewChat";
import { FeedbackReport } from "@/components/FeedbackReport";
import {
  classifyResponse,
  createSessionPlan,
  getFeedback,
  getNextQuestion,
  getRephrasedQuestion,
  regenerateQuestion,
  type SessionPlan,
} from "@/services/mockApi";
import type {
  CandidateAnswer,
  ChatMessage,
  FeedbackSummary,
  InterviewTurn,
} from "@/types/interview";
import { MAX_REPHRASES_PER_QUESTION, TOTAL_QUESTIONS } from "@/types/interview";

const title = "Interview Agent — AI Technical Screener";
const description =
  "Run a 7-question adaptive mock interview for engineering, product, data, marketing and sales roles, then get a scored readiness report.";

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
type PendingTask =
  | { kind: "next"; history: CandidateAnswer[] }
  | { kind: "rephrase"; turn: InterviewTurn; attempt: number }
  | { kind: "regenerate"; turn: InterviewTurn }
  | { kind: "feedback" };

function Index() {
  const [stage, setStage] = useState<Stage>("select");
  const [role, setRole] = useState("");
  const [plan, setPlan] = useState<SessionPlan | null>(null);
  const [turns, setTurns] = useState<InterviewTurn[]>([]);
  const [answers, setAnswers] = useState<CandidateAnswer[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [thinkingLabel, setThinkingLabel] = useState("Agent is thinking…");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingTask | null>(null);
  const [feedback, setFeedback] = useState<FeedbackSummary | null>(null);

  /** How many times the current question slot has been rephrased. */
  const rephrasesForSlot = useRef(0);

  const fail = (task: PendingTask, message: string) => {
    setPending(task);
    setError(message);
    setIsThinking(false);
  };

  const runNext = useCallback(
    async (forRole: string, history: CandidateAnswer[], forPlan: SessionPlan) => {
      setError(null);
      setThinkingLabel("Agent is writing the next question…");
      setIsThinking(true);
      try {
        const turn = await getNextQuestion(forRole, history, forPlan);
        rephrasesForSlot.current = 0;
        setTurns((prev) => [...prev, turn]);
        setMessages((prev) => [...prev, { kind: "question", turn }]);
        setIsThinking(false);
        setPending(null);
      } catch {
        fail({ kind: "next", history }, "The agent couldn't generate the next question.");
      }
    },
    [],
  );

  const runRephrase = useCallback(async (turn: InterviewTurn, attempt: number) => {
    setError(null);
    setThinkingLabel("Agent is rephrasing the question…");
    setIsThinking(true);
    try {
      const next = await getRephrasedQuestion(turn, attempt);
      setTurns((prev) => [...prev, next]);
      setMessages((prev) => [...prev, { kind: "question", turn: next }]);
      setIsThinking(false);
      setPending(null);
    } catch {
      fail({ kind: "rephrase", turn, attempt }, "The agent couldn't rephrase that question.");
    }
  }, []);

  const runRegenerate = useCallback(
    async (forRole: string, history: CandidateAnswer[], forPlan: SessionPlan, turn: InterviewTurn) => {
      setError(null);
      setThinkingLabel("Agent is picking a different question…");
      setIsThinking(true);
      try {
        const result = await regenerateQuestion(forRole, history, forPlan, turn);
        setPlan(result.plan);
        setTurns((prev) => [...prev, result.turn]);
        setMessages((prev) => [...prev, { kind: "question", turn: result.turn }]);
        setIsThinking(false);
        setPending(null);
      } catch {
        fail({ kind: "regenerate", turn }, "The agent couldn't swap that question out.");
      }
    },
    [],
  );

  const runFeedback = useCallback(
    async (forRole: string, allTurns: InterviewTurn[], allAnswers: CandidateAnswer[]) => {
      setError(null);
      setThinkingLabel("Agent is scoring your answers…");
      setIsThinking(true);
      try {
        const report = await getFeedback(forRole, allTurns, allAnswers);
        setFeedback(report);
        setIsThinking(false);
        setPending(null);
        setStage("feedback");
      } catch {
        fail({ kind: "feedback" }, "The agent couldn't score this session.");
      }
    },
    [],
  );

  const start = (nextRole: string) => {
    const nextPlan = createSessionPlan(nextRole);
    setRole(nextRole);
    setPlan(nextPlan);
    setTurns([]);
    setAnswers([]);
    setMessages([]);
    setFeedback(null);
    setError(null);
    setPending(null);
    rephrasesForSlot.current = 0;
    setStage("interview");
    void runNext(nextRole, [], nextPlan);
  };

  const submitAnswer = (text: string) => {
    const currentTurn = turns.at(-1);
    if (!currentTurn || !plan) return;

    let kind = classifyResponse(text);

    // After the allowed rephrases, whatever comes next is scored for this slot
    // so the interview can never stall.
    if (kind === "clarification" && rephrasesForSlot.current >= MAX_REPHRASES_PER_QUESTION) {
      kind = "non-answer";
    }

    const response: CandidateAnswer = {
      id: Math.random().toString(36).slice(2, 10),
      turnId: currentTurn.id,
      text,
      wordCount: text.trim().split(/\s+/).filter(Boolean).length,
      answeredAt: Date.now(),
      kind,
    };

    setMessages((prev) => [...prev, { kind: "answer", answer: response }]);

    // Clarification: not scored, counter does not advance — just restate it.
    if (kind === "clarification") {
      const attempt = rephrasesForSlot.current + 1;
      rephrasesForSlot.current = attempt;
      void runRephrase(currentTurn, attempt);
      return;
    }

    const history = [...answers, response];
    setAnswers(history);

    if (history.length >= TOTAL_QUESTIONS) {
      void runFeedback(role, turns, history);
      return;
    }
    void runNext(role, history, plan);
  };

  const skipQuestion = () => {
    const currentTurn = turns.at(-1);
    if (!currentTurn || !plan || isThinking) return;
    void runRegenerate(role, answers, plan, currentTurn);
  };

  const retry = () => {
    if (!pending || !plan) return;
    if (pending.kind === "next") void runNext(role, pending.history, plan);
    else if (pending.kind === "rephrase") void runRephrase(pending.turn, pending.attempt);
    else if (pending.kind === "regenerate") void runRegenerate(role, answers, plan, pending.turn);
    else void runFeedback(role, turns, answers);
  };

  // Safety net: if all scored answers are in but no report exists, compile it.
  useEffect(() => {
    if (stage !== "interview" || answers.length < TOTAL_QUESTIONS) return;
    if (feedback || isThinking || error) return;
    void runFeedback(role, turns, answers);
  }, [stage, answers, turns, role, feedback, isThinking, error, runFeedback]);

  /** Counter follows the question actually on screen, never runs ahead of it. */
  const visibleQuestionNumber = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const m = messages[i]!;
      if (m.kind === "question") return m.turn.index;
    }
    return 1;
  }, [messages]);

  if (stage === "select") return <RoleSelector onStart={start} />;

  if (stage === "feedback" && feedback)
    return <FeedbackReport feedback={feedback} onRestart={() => setStage("select")} />;

  return (
    <InterviewChat
      role={role}
      messages={messages}
      questionNumber={visibleQuestionNumber}
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
