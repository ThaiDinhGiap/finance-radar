import { useEffect, useState } from "react";
import { request } from "../../shared/api";
import type { Article, Page } from "../../shared/types";
import type { ReadingScope } from "./types";
const key = "finance-radar.personal.v1";
export interface Preferences {
  selected: string[];
  history: boolean;
  reads: string[];
  days: number;
}
const empty: Preferences = { selected: [], history: false, reads: [], days: 7 };
function load(): Preferences {
  try {
    const p = JSON.parse(localStorage.getItem(key) || "null");
    return p && Array.isArray(p.selected) && Array.isArray(p.reads) ? p : empty;
  } catch {
    return empty;
  }
}
function save(p: Preferences) {
  localStorage.setItem(key, JSON.stringify(p));
  window.dispatchEvent(new Event("radar-personal"));
}
export function recordRead(id: string) {
  try {
    const p = load();
    if (p.history)
      save({
        ...p,
        reads: [id, ...p.reads.filter((v) => v !== id)].slice(0, 200),
      });
  } catch {
    /* Reading remains available when browser storage is full. */
  }
}
export interface Recommendation {
  storyId: string;
  article: Article;
  score: number;
  reasons: string[];
  read: boolean;
}
export function usePersonalFeed(
  scopes: { id: string; name: string; scope: ReadingScope }[],
  revision: number,
) {
  const [preferences, setPreferences] = useState<Preferences>(load);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Page<Recommendation>>();
  const [page, setPage] = useState(0);
  useEffect(() => {
    const sync = () => setPreferences(load());
    window.addEventListener("radar-personal", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("radar-personal", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  const body = JSON.stringify({
    interests: scopes
      .filter((s) => preferences.selected.includes(s.id))
      .map((s) => ({
        name: s.name,
        sourceId: s.scope.sourceId || null,
        language: s.scope.language,
        filter: { ...s.scope.filter, days: s.scope.days },
      })),
    readIds: preferences.history ? preferences.reads : [],
    learnFromHistory: preferences.history,
    days: preferences.days,
    page,
    size: 15,
  });
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    request<Page<Recommendation>>("/feed/personalized", {
      method: "POST",
      body,
      signal: controller.signal,
    })
      .then(setData)
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [body, revision]);
  function update(next: Preferences) {
    try {
      if (next.selected.length > 30)
        throw new Error("Chọn tối đa 30 mối quan tâm.");
      save(next);
      setPage(0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không lưu được tùy chọn.");
    }
  }
  return { preferences, update, error, loading, data, page, setPage };
}
