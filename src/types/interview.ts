export type Role =
  | "Frontend Developer"
  | "Backend Developer"
  | "Product Manager"
  | "Data Analyst"
  | "Marketing"
  | "Sales"
  | (string & {});

/** The six question categories a session is assembled from (core technical appears twice). */
export type QuestionCategory =
  "warmup" | "core-a" | "core-b" | "scenario" | "behavioral" | "tradeoff" | "closing";

export interface InterviewTurn {
  id: string;
  /** 1-based index of the question in the interview */
  index: number;
  question: string;
  topic: string;
  askedAt: number;
  /** true when this turn is a simplified restatement of the previous question */
  isRephrase?: boolean;
}

/** How a candidate response was interpreted before scoring. */
export type ResponseKind = "clarification" | "non-answer" | "real";

export interface CandidateAnswer {
  id: string;
  turnId: string;
  text: string;
  wordCount: number;
  answeredAt: number;
  kind: ResponseKind;
}

export type ChatMessage =
  { kind: "question"; turn: InterviewTurn } | { kind: "answer"; answer: CandidateAnswer };

export interface FeedbackPoint {
  title: string;
  detail: string;
  /** short quote pulled from the candidate's own answer */
  quote: string;
}

export interface FeedbackSummary {
  role: string;
  score: number;
  summary: string;
  strengths: FeedbackPoint[];
  /** shown instead of strengths when there wasn't enough substance to praise */
  strengthsNote?: string;
  improvements: FeedbackPoint[];
}

export const TOTAL_QUESTIONS = 7;

/** How many times the agent will rephrase a single question before forcing an answer. */
export const MAX_REPHRASES_PER_QUESTION = 2;
