import { useState, type FormEvent } from "react";
import { Modal } from "../../shared/Modal";
import type { Source } from "../../shared/types";
import { useLibrary } from "./useLibrary";
import {
  describeScope,
  watchScope,
  type ReadingScope,
  type Topic,
  type Watchlist,
} from "./types";
export function LibraryPanel({
  scope,
  apply,
  sources,
  topics,
}: {
  scope: ReadingScope;
  apply: (scope: ReadingScope) => void;
  sources: Source[];
  topics: Topic[];
}) {
  const library = useLibrary();
  const [searchName, setSearchName] = useState("");
  const [editing, setEditing] = useState<Watchlist | null>(null);
  const [keywords, setKeywords] = useState("");
  const [notice, setNotice] = useState("");
  function saveSearch(e: FormEvent) {
    e.preventDefault();
    if (!searchName.trim()) return;
    if (
      library.update((current) => ({
        ...current,
        searches: [
          ...current.searches,
          {
            id: crypto.randomUUID(),
            name: searchName.trim(),
            scope,
          },
        ],
      }))
    ) {
      setSearchName("");
      setNotice("Đã lưu truy vấn và bộ lọc.");
    }
  }
  function edit(watch?: Watchlist) {
    setEditing(
      watch ?? {
        id: crypto.randomUUID(),
        name: "",
        topicIds: [],
        watchedSourceIds: [],
        keywords: [],
        seenAt: new Date().toISOString(),
      },
    );
    setKeywords(watch?.keywords.join("\n") ?? "");
  }
  function saveWatch(e: FormEvent) {
    e.preventDefault();
    if (!editing) return;
    const words = [
      ...new Set(
        keywords
          .split("\n")
          .map((v) => v.trim())
          .filter(Boolean),
      ),
    ];
    if (
      !editing.name.trim() ||
      (!words.length &&
        !editing.topicIds.length &&
        !editing.watchedSourceIds.length)
    ) {
      setNotice("Watchlist cần tên và ít nhất một mục theo dõi.");
      return;
    }
    if (words.length > 30 || words.some((v) => v.length > 100)) {
      setNotice("Tối đa 30 từ khóa, mỗi từ khóa 100 ký tự.");
      return;
    }
    const watch = { ...editing, name: editing.name.trim(), keywords: words };
    if (
      library.update((current) => ({
        ...current,
        watches: [...current.watches.filter((w) => w.id !== watch.id), watch],
      }))
    ) {
      setEditing(null);
      setNotice("Đã lưu Watchlist.");
    }
  }
  return (
    <section className="discovery-library" aria-label="Thư viện cá nhân">
      <h2>Tìm kiếm đã lưu & Watchlist</h2>
      <p className="hint">
        Lưu riêng trên trình duyệt này. Khoảng thời gian được tính lại mỗi lần
        mở.
      </p>
      {library.error && (
        <p className="error-box" role="alert">
          {library.error}
        </p>
      )}
      <p role="status">{notice}</p>
      <form onSubmit={saveSearch} className="discovery-actions">
        <label>
          Tên tìm kiếm
          <input
            value={searchName}
            onChange={(e) => setSearchName(e.target.value)}
            required
            maxLength={80}
            placeholder="Đầu tư công Nghệ An"
          />
        </label>
        <button className="button secondary" type="submit">
          Lưu tìm kiếm hiện tại
        </button>
      </form>
      {library.searches.map((saved) => (
        <div className="library-entry" key={saved.id}>
          <button
            className="link-button"
            title={describeScope(saved.scope)}
            onClick={() => apply(saved.scope)}
          >
            {saved.name}
          </button>
          <button
            className="link-button"
            aria-label={`Cập nhật ${saved.name}`}
            onClick={() =>
              library.update((c) => ({
                ...c,
                searches: c.searches.map((s) =>
                  s.id === saved.id ? { ...s, scope } : s,
                ),
              }))
            }
          >
            Lưu bộ lọc mới
          </button>
          <button
            className="link-button"
            aria-label={`Xóa ${saved.name}`}
            onClick={() =>
              library.update((c) => ({
                ...c,
                searches: c.searches.filter((s) => s.id !== saved.id),
              }))
            }
          >
            Xóa
          </button>
        </div>
      ))}
      <button className="button secondary" onClick={() => edit()}>
        Tạo Watchlist
      </button>
      {library.watches.map((watch) => (
        <div className="library-entry" key={watch.id}>
          <strong>{watch.name}</strong>
          <button
            className="link-button"
            onClick={() => apply(watchScope(watch))}
          >
            Xem tin
          </button>
          <button
            className="link-button"
            onClick={() => apply(watchScope(watch, true))}
          >
            Tin mới
          </button>
          <button
            className="link-button"
            onClick={() => {
              library.update((c) => ({
                ...c,
                watches: c.watches.map((w) =>
                  w.id === watch.id
                    ? { ...w, seenAt: new Date().toISOString() }
                    : w,
                ),
              }));
              setNotice("Đã ghi nhận thời điểm xem Watchlist.");
            }}
          >
            Đánh dấu đã xem
          </button>
          <button
            className="link-button"
            aria-label={`Sửa ${watch.name}`}
            onClick={() => edit(watch)}
          >
            Sửa
          </button>
          <button
            className="link-button"
            aria-label={`Xóa ${watch.name}`}
            onClick={() =>
              library.update((c) => ({
                ...c,
                watches: c.watches.filter((w) => w.id !== watch.id),
              }))
            }
          >
            Xóa
          </button>
        </div>
      ))}
      {editing && (
        <Modal title="Thiết lập Watchlist" close={() => setEditing(null)}>
          <form className="watchlist-form" onSubmit={saveWatch}>
            <label>
              Tên Watchlist
              <input
                required
                maxLength={80}
                value={editing.name}
                onChange={(e) =>
                  setEditing({ ...editing, name: e.target.value })
                }
              />
            </label>
            <label>
              Entity / Topic
              <select
                multiple
                value={editing.topicIds}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    topicIds: Array.from(
                      e.target.selectedOptions,
                      (o) => o.value,
                    ),
                  })
                }
              >
                {topics.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Nguồn theo dõi
              <select
                multiple
                value={editing.watchedSourceIds}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    watchedSourceIds: Array.from(
                      e.target.selectedOptions,
                      (o) => o.value,
                    ),
                  })
                }
              >
                {sources.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Từ khóa (mỗi dòng một cụm)
              <textarea
                rows={4}
                maxLength={3030}
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
              />
            </label>
            <p className="hint">
              Tin khớp bất kỳ mục nào trong danh sách. Giữ Ctrl / Command để
              chọn nhiều mục. “Tin mới” tính theo thời điểm thu thập kể từ lần
              đánh dấu đã xem.
            </p>
            <p role="status">{notice}</p>
            <button className="button primary" type="submit">
              Lưu Watchlist
            </button>
          </form>
        </Modal>
      )}
    </section>
  );
}
