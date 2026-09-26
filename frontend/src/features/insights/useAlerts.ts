import { useEffect, useState } from "react";
import { request } from "../../shared/api";
import type { Article } from "../../shared/types";
import { watchScope, type Watchlist } from "../discovery/types";
export interface AlertRule {
  enabled: boolean;
  minimum: number;
  keyword: string;
  since?: string;
  watchSignature?: string;
}
export interface AlertNotice {
  id: string;
  watchId: string;
  watchName: string;
  count: number;
  at: string;
  articles: Article[];
  read: boolean;
}
interface State {
  rules: Record<string, AlertRule>;
  notices: AlertNotice[];
}
interface Check {
  checkedThrough: string;
  count: number;
  triggered: boolean;
  articles: Article[];
}
const key = "finance-radar.alerts.v1";
function load(): State {
  const raw = localStorage.getItem(key);
  if (!raw) return { rules: {}, notices: [] };
  const parsed = JSON.parse(raw) as State;
  if (!parsed.rules || !Array.isArray(parsed.notices))
    throw new Error("Dữ liệu cảnh báo không hợp lệ.");
  return parsed;
}
function save(state: State) {
  localStorage.setItem(key, JSON.stringify(state));
  window.dispatchEvent(new Event("radar-alerts"));
}
export function useAlerts(watches: Watchlist[]) {
  const [state, setState] = useState<State>({ rules: {}, notices: [] });
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);
  const [revision, setRevision] = useState(0);
  const [desktop, setDesktop] = useState(false);
  useEffect(() => {
    const sync = () => {
      try {
        setState(load());
      } catch {
        setError("Không đọc được cảnh báo đã lưu trên trình duyệt.");
      }
    };
    sync();
    window.addEventListener("storage", sync);
    window.addEventListener("radar-alerts", sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("radar-alerts", sync);
    };
  }, []);
  const ruleSignature = JSON.stringify(state.rules);
  const watchSignature = JSON.stringify(watches);
  useEffect(() => {
    const controller = new AbortController();
    let running = false;
    async function check() {
      if (running || controller.signal.aborted) return;
      running = true;
      setChecking(true);
      try {
        const failures: string[] = [];
        const work = async () => {
          const currentWatches = JSON.parse(watchSignature) as Watchlist[];
          for (const watch of currentWatches) {
            if (controller.signal.aborted) return;
            const initial = load().rules[watch.id];
            if (!initial?.enabled) continue;
            try {
              const signature = JSON.stringify([
                watch.topicIds,
                watch.watchedSourceIds,
                watch.keywords,
              ]);
              const since =
                initial.watchSignature === signature
                  ? initial.since
                  : undefined;
              const result = await request<Check>("/alerts/check", {
                method: "POST",
                signal: controller.signal,
                body: JSON.stringify({
                  filter: { ...watchScope(watch).filter, q: initial.keyword },
                  since: since ?? null,
                  minimum: initial.minimum,
                }),
              });
              if (controller.signal.aborted) return;
              const latest = load();
              if (
                JSON.stringify(latest.rules[watch.id]) !==
                JSON.stringify(initial)
              )
                continue;
              if (!since || result.triggered) {
                latest.rules[watch.id] = {
                  ...initial,
                  since: result.checkedThrough,
                  watchSignature: signature,
                };
                if (result.triggered) {
                  const notice: AlertNotice = {
                    id: `${watch.id}:${result.checkedThrough}`,
                    watchId: watch.id,
                    watchName: watch.name,
                    count: result.count,
                    at: result.checkedThrough,
                    articles: result.articles,
                    read: false,
                  };
                  latest.notices = [notice, ...latest.notices].slice(0, 100);
                }
                save(latest);
                if (
                  result.triggered &&
                  desktop &&
                  typeof Notification !== "undefined" &&
                  Notification.permission === "granted"
                ) {
                  new Notification(`Finance Radar · ${watch.name}`, {
                    body: `${result.count} tin mới phù hợp`,
                    tag: watch.id,
                  });
                }
              }
            } catch (e) {
              if (controller.signal.aborted) return;
              failures.push(
                `${watch.name}: ${e instanceof Error ? e.message : "Không kiểm tra được cảnh báo"}`,
              );
            }
          }
        };
        if (navigator.locks)
          await navigator.locks.request(
            "finance-radar-alert-check",
            { ifAvailable: true },
            async (lock) => {
              if (lock) await work();
            },
          );
        else await work();
        if (!controller.signal.aborted) setError(failures.join(" "));
      } catch (e) {
        if (!controller.signal.aborted)
          setError(
            e instanceof Error ? e.message : "Không kiểm tra được cảnh báo.",
          );
      } finally {
        running = false;
        if (!controller.signal.aborted) setChecking(false);
      }
    }
    void check();
    const timer = setInterval(() => void check(), 60000);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [ruleSignature, watchSignature, revision, desktop]);
  function configure(id: string, rule: AlertRule) {
    try {
      const next = load();
      next.rules[id] = {
        enabled: rule.enabled,
        minimum: rule.minimum,
        keyword: rule.keyword,
      };
      if (Object.values(next.rules).filter((r) => r.enabled).length > 20)
        throw new Error("Tối đa 20 cảnh báo đang bật.");
      save(next);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không lưu được cảnh báo.");
    }
  }
  function markRead(id?: string) {
    try {
      const next = load();
      next.notices = next.notices.map((n) =>
        !id || n.id === id ? { ...n, read: true } : n,
      );
      save(next);
    } catch {
      setError("Không lưu được trạng thái đã đọc.");
    }
  }
  async function enableDesktop() {
    if (typeof Notification === "undefined") {
      setError("Trình duyệt không hỗ trợ thông báo hệ thống.");
      return;
    }
    const permission = await Notification.requestPermission();
    setDesktop(permission === "granted");
    if (permission !== "granted")
      setError(
        "Thông báo hệ thống chưa được cho phép; cảnh báo trong ứng dụng vẫn hoạt động.",
      );
  }
  return {
    ...state,
    error,
    checking,
    desktop,
    configure,
    markRead,
    enableDesktop,
    refresh: () => setRevision((v) => v + 1),
  };
}
export type AlertsModel = ReturnType<typeof useAlerts>;
