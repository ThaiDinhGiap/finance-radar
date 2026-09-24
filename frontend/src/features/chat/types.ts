import type { Article } from "../../shared/types";
export interface ChatStatus {
  configured: boolean;
  provider: string;
  model: string;
  embeddingModel: string;
  index: { ready: number; pending: number; failed: number; chunks: number };
  knowledge: {
    articles: number;
    sources: number;
    lastCollectedAt: string | null;
  };
}
export interface Statement {
  text: string;
  evidence: { articleId: string; quote: string }[];
}
export interface ChatAnswer {
  status: "ANSWERED" | "NO_EVIDENCE" | "INSUFFICIENT_EVIDENCE";
  message: string;
  statements: Statement[];
  sources: Article[];
  answeredAt: string;
}
export interface ChatScope {
  sourceId: string;
  language: string;
  days: number;
}
export interface ChatTurn {
  id: string;
  question: string;
  scope: ChatScope;
  answer?: ChatAnswer;
  retrieval?: Article[];
  error?: string;
}
