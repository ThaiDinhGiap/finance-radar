import { useEffect, useState } from "react";
import type { SavedSearch, Watchlist } from "./types";
const key = "finance-radar.library.v1";
interface Library {
  searches: SavedSearch[];
  watches: Watchlist[];
}
const empty: Library = { searches: [], watches: [] };
function read(): Library {
  const raw = localStorage.getItem(key);
  if (!raw) return empty;
  const data = JSON.parse(raw) as Library;
  if (
    !Array.isArray(data.searches) ||
    !Array.isArray(data.watches) ||
    data.searches.some(
      (s) =>
        typeof s.name !== "string" ||
        !s.scope ||
        typeof s.scope.days !== "number",
    ) ||
    data.watches.some(
      (w) =>
        typeof w.name !== "string" ||
        !Array.isArray(w.topicIds) ||
        !Array.isArray(w.watchedSourceIds) ||
        !Array.isArray(w.keywords),
    )
  )
    throw new Error("Dữ liệu thư viện không hợp lệ.");
  return data;
}
export function useLibrary() {
  const [library, setLibrary] = useState<Library>(empty);
  const [error, setError] = useState("");
  useEffect(() => {
    function sync() {
      try {
        setLibrary(read());
        setError("");
      } catch {
        setError(
          "Không đọc được thư viện cá nhân. Kiểm tra quyền lưu trữ của trình duyệt.",
        );
      }
    }
    sync();
    window.addEventListener("storage", sync);
    window.addEventListener("radar-library", sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("radar-library", sync);
    };
  }, []);
  function update(change: (current: Library) => Library): boolean {
    try {
      const next = change(read());
      if (next.searches.length > 100 || next.watches.length > 100)
        throw new Error("Giới hạn 100 mục mỗi loại.");
      localStorage.setItem(key, JSON.stringify(next));
      setLibrary(next);
      setError("");
      window.dispatchEvent(new Event("radar-library"));
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể lưu thư viện.");
      return false;
    }
  }
  return { ...library, error, update };
}
