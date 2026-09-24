import { useEffect, useState } from "react";
import { request } from "./api";
export function useResource<T>(path: string, revision = 0, poll = 0) {
  const [data, setData] = useState<T>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    setLoading(true);
    async function load() {
      try {
        const value = await request<T>(path, { signal: controller.signal });
        if (active) {
          setData(value);
          setError("");
        }
      } catch (e) {
        if (active)
          setError(e instanceof Error ? e.message : "Lỗi tải dữ liệu");
      } finally {
        if (active) {
          setLoading(false);
          if (poll) timer = setTimeout(load, poll);
        }
      }
    }
    void load();
    return () => {
      active = false;
      controller.abort();
      clearTimeout(timer);
    };
  }, [path, revision, poll]);
  return { data, error, loading };
}
