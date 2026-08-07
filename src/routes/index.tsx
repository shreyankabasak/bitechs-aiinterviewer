import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { RoleSelector } from "@/components/RoleSelector";
import { InterviewChat } from "@/components/InterviewChat";
import { FeedbackReport } from "@/components/FeedbackReport";
import {
  classifyResponse,
  createSessionPlan,
  getFeedback,
  getNextQuestion,
  getRephrasedQuestion,
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

function Index() {
  const [stage, setStage] = useState<Stage>("select");
  const [role, setRole] = useState("");
  const [plan, setPlan] = useState<SessionPlan | null>(null);
  const [turns, setTurns] = useState<InterviewTurn[]>([]);
  const [answers, setAnswers] = useState<CandidateAnswer[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackSummary | null>(null);

  /** How many times the current question slot has been rephrased. */
  const rephrasesForSlot = useRef(0);

  const askNext = useCallback(
    async (forRole: string, history: CandidateAnswer[], forPlan: SessionPlan) => {
      setIsThinking(true);
      const turn = await getNextQuestion(forRole, history, forPlan);
      rephrasesForSlot.current = 0;
      setTurns((prev) => [...prev, turn]);
      setMessages((prev) => [...prev, { kind: "question", turn }]);
      setIsThinking(false);
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
    rephrasesForSlot.current = 0;
    setStage("interview");
    void askNext(nextRole, [], nextPlan);
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
      setIsThinking(true);
      void (async () => {
        const turn = await getRephrasedQuestion(currentTurn, attempt);
        setTurns((prev) => [...prev, turn]);
        setMessages((prev) => [...prev, { kind: "question", turn }]);
        setIsThinking(false);
      })();
      return;
    }

    const history = [...answers, response];
    setAnswers(history);

    if (history.length >= TOTAL_QUESTIONS) {
      setIsThinking(true);
      return;
    }
    void askNext(role, history, plan);
  };

  // Once all 7 scored answers are in, compile the report.
  useEffect(() => {
    if (stage !== "interview" || answers.length < TOTAL_QUESTIONS) return;
    let cancelled = false;
    void (async () => {
      const report = await getFeedback(role, turns, answers);
      if (cancelled) return;
      setFeedback(report);
      setIsThinking(false);
      setStage("feedback");
    })();
    return () => {
      cancelled = true;
    };
  }, [stage, answers, turns, role]);

  if (stage === "select") return <RoleSelector onStart={start} />;

  if (stage === "feedback" && feedback)
    return <FeedbackReport feedback={feedback} onRestart={() => setStage("select")} />;

  return (
    <InterviewChat
      role={role}
      messages={messages}
      questionNumber={Math.max(answers.length + 1, 1)}
      isThinking={isThinking}
      onSubmitAnswer={submitAnswer}
    />
  );
}
