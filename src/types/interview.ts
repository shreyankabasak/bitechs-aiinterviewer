export type Role =
  | "Frontend Developer"
  | "Backend Developer"
  | "Product Manager"
  | "Data Analyst"
  | "Marketing"
  | "Sales"
  | (string & {});

export interface InterviewTurn {
  id: string;
  /** 1-based index of the question in the interview */
  index: number;
  question: string;
  topic: string;
  askedAt: number;
}

export interface CandidateAnswer {
  id: string;
  turnId: string;
  text: string;
  wordCount: number;
  answeredAt: number;
}

export type ChatMessage =
  | { kind: "question"; turn: InterviewTurn }
  | { kind: "answer"; answer: CandidateAnswer };

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
  strengths: [FeedbackPoint, FeedbackPoint];
  improvements: [FeedbackPoint, FeedbackPoint];
}

export const TOTAL_QUESTIONS = 7;
