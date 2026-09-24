import { useEffect, useRef, useState } from "react";
import { request } from "../../shared/api";
import type { Article } from "../../shared/types";
import type { ChatAnswer, ChatScope, ChatTurn } from "./types";
export function useChat() {
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [busy, setBusy] = useState(false);
  const active = useRef<AbortController | null>(null);
  useEffect(() => () => active.current?.abort(), []);
  async function send(
    question: string,
    scope: ChatScope,
    mode: "answer" | "retrieve",
  ) {
    if (active.current) return false;
    const controller = new AbortController();
    active.current = controller;
    setBusy(true);
    const id = crypto.randomUUID();
    const previousQuestions = turns
      .filter((t) => !t.error && (t.answer || t.retrieval))
      .slice(-3)
      .map((t) => t.question);
    setTurns((v) => [...v, { id, question, scope }]);
    try {
      const payload = {
        question,
        previousQuestions,
        sourceId: scope.sourceId || null,
        language: scope.language,
        days: scope.days,
      };
      const result = await request<ChatAnswer | Article[]>(`/chat/${mode}`, {
        method: "POST",
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      if (!controller.signal.aborted)
        setTurns((v) =>
          v.map((t) =>
            t.id === id
              ? {
                  ...t,
                  ...(mode === "answer"
                    ? { answer: result as ChatAnswer }
                    : { retrieval: result as Article[] }),
                }
              : t,
          ),
        );
      return true;
    } catch (e) {
      if (!controller.signal.aborted)
        setTurns((v) =>
          v.map((t) =>
            t.id === id
              ? {
                  ...t,
                  error:
                    e instanceof Error ? e.message : "Không thể xử lý câu hỏi.",
                }
              : t,
          ),
        );
      return false;
    } finally {
      if (active.current === controller) {
        active.current = null;
        setBusy(false);
      }
    }
  }
  function clear() {
    if (!active.current) setTurns([]);
  }
  return { turns, busy, send, clear };
}
