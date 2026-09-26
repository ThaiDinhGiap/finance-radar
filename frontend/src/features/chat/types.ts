import type { Article } from "../../shared/types";
export interface ProviderActivity {
  status: "UNKNOWN" | "HEALTHY" | "DEGRADED" | "STALE";
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  lastErrorType: string | null;
}
export interface ChatStatus {
  configured: boolean;
  activity?: { embedding: ProviderActivity; generation: ProviderActivity };
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
export type ChatScope = import("../discovery/types").ReadingScope;
export interface ChatTurn {
  id: string;
  question: string;
  scope: ChatScope;
  answer?: ChatAnswer;
  retrieval?: Article[];
  error?: string;
}
