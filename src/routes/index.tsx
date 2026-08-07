import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { RoleSelector } from "@/components/RoleSelector";
import { InterviewChat } from "@/components/InterviewChat";
import { FeedbackReport } from "@/components/FeedbackReport";
import { getFeedback, getNextQuestion } from "@/services/mockApi";
import type {
  CandidateAnswer,
  ChatMessage,
  FeedbackSummary,
  InterviewTurn,
} from "@/types/interview";
import { TOTAL_QUESTIONS } from "@/types/interview";

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
  const [turns, setTurns] = useState<InterviewTurn[]>([]);
  const [answers, setAnswers] = useState<CandidateAnswer[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackSummary | null>(null);

  const askNext = useCallback(
    async (forRole: string, history: CandidateAnswer[]) => {
      setIsThinking(true);
      const turn = await getNextQuestion(forRole, history);
      setTurns((prev) => [...prev, turn]);
      setMessages((prev) => [...prev, { kind: "question", turn }]);
      setIsThinking(false);
    },
    [],
  );

  const start = (nextRole: string) => {
    setRole(nextRole);
    setTurns([]);
    setAnswers([]);
    setMessages([]);
    setFeedback(null);
    setStage("interview");
    void askNext(nextRole, []);
  };

  const submitAnswer = (text: string) => {
    const currentTurn = turns.at(-1);
    if (!currentTurn) return;

    const answer: CandidateAnswer = {
      id: Math.random().toString(36).slice(2, 10),
      turnId: currentTurn.id,
      text,
      wordCount: text.trim().split(/\s+/).filter(Boolean).length,
      answeredAt: Date.now(),
    };

    const history = [...answers, answer];
    setAnswers(history);
    setMessages((prev) => [...prev, { kind: "answer", answer }]);

    if (history.length >= TOTAL_QUESTIONS) {
      setIsThinking(true);
      return;
    }
    void askNext(role, history);
  };

  // Once all 7 answers are in, compile the report.
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
      questionNumber={Math.max(turns.length, 1)}
      isThinking={isThinking}
      onSubmitAnswer={submitAnswer}
    />
  );
}
