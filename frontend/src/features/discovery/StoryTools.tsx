import { useState } from "react";
import { useResource } from "../../shared/useResource";
import { request } from "../../shared/api";
import { LoadingState } from "../../shared/LoadingState";
import { dateTime, type Article, type Page } from "../../shared/types";
import type { Story } from "./types";
import { recordRead } from "./usePersonalFeed";
interface Coverage {
  storyId: string;
  total: number;
  sources: {
    sourceId: string;
    sourceName: string;
    topics: string[];
    articles: Article[];
  }[];
}
export function StoryTools({
  storyId,
  mode,
  changed,
}: {
  storyId: string;
  mode: "coverage" | "curation";
  changed: () => void;
}) {
  const [revision, setRevision] = useState(0);
  const coverage = useResource<Coverage>(
    `/stories/${storyId}/coverage`,
    revision,
  );
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const targets = useResource<Page<Story>>(
    `/stories?q=${encodeURIComponent(query)}&size=20`,
    revision,
  );
  const [target, setTarget] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const members = coverage.data?.sources.flatMap((s) => s.articles) ?? [];
  async function curate() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await request("/stories/curate", {
        method: "POST",
        body: JSON.stringify({
          articleIds: selected,
          targetStoryId: target || null,
          expectedStoryId: coverage.data?.storyId,
          reason,
        }),
      });
      setMessage(
        `Đã ${target ? "chuyển vào Story đã chọn" : "tách sang Story mới"} ${selected.length} bài. Quyết định đã được lưu.`,
      );
      setSelected([]);
      setRevision((v) => v + 1);
      changed();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không chỉnh được Story.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="digest-group">
      <h2>{mode === "coverage" ? "Compare Coverage" : "Story Curation"}</h2>
      <p className="hint">
        {mode === "coverage"
          ? "Đối chiếu góc đưa tin qua tiêu đề, tóm tắt và nhãn chủ đề của từng nguồn. Đây là trích nội dung nguồn, không phải kết luận về thiên kiến hay độ đúng sai."
          : "Chọn các bài cần chuyển. Để trống Story đích để tách thành nhóm mới; chọn một Story để gộp. Các nhóm bị chỉnh sẽ được giữ khỏi gom lại tự động."}
      </p>
      {(coverage.error || error) && (
        <p role="alert" className="error-box">
          {coverage.error || error}{" "}
          <button
            className="link-button"
            onClick={() => setRevision((v) => v + 1)}
          >
            Thử lại
          </button>
        </p>
      )}
      {message && <p role="status">{message}</p>}
      {coverage.loading ? (
        <LoadingState label="Đang đối chiếu nguồn…" />
      ) : (
        <>
          <p>
            {coverage.data?.total ?? 0} bài ·{" "}
            {coverage.data?.sources.length ?? 0} nguồn hiển thị
          </p>
          {(coverage.data?.total ?? 0) > members.length && (
            <p className="hint">
              Chỉ hiển thị 200 bài đầu. Chỉnh các bài đã chọn trong phần này;
              không gộp ngầm phần còn lại.
            </p>
          )}
          {mode === "curation" && (
            <button
              className="button secondary"
              onClick={() => setSelected(members.map((a) => a.id))}
            >
              Chọn mọi bài đang hiển thị
            </button>
          )}
          <div className="coverage-grid">
            {coverage.data?.sources.map((source) => (
              <section className="digest-group" key={source.sourceId}>
                <h3>{source.sourceName}</h3>
                <p className="hint">
                  Nhãn nội dung: {source.topics.join(" · ") || "Chưa nhận diện"}
                </p>
                {source.articles.map((a) => (
                  <article className="story-member" key={a.id}>
                    {mode === "curation" && (
                      <label>
                        <input
                          type="checkbox"
                          checked={selected.includes(a.id)}
                          onChange={(e) =>
                            setSelected((v) =>
                              e.target.checked
                                ? [...v, a.id]
                                : v.filter((id) => id !== a.id),
                            )
                          }
                        />{" "}
                        Chọn {a.title}
                      </label>
                    )}
                    <h4>
                      <a
                        href={a.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => recordRead(a.id)}
                      >
                        {a.title}
                      </a>
                    </h4>
                    <p>{a.summary || "Nguồn không cung cấp tóm tắt."}</p>
                    <small>{dateTime(a.publishedAt || a.collectedAt)}</small>
                  </article>
                ))}
              </section>
            ))}
          </div>
          {mode === "curation" && (
            <form
              className="discovery-form"
              onSubmit={(e) => {
                e.preventDefault();
                void curate();
              }}
            >
              <label>
                Tìm Story đích
                <input
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setTarget("");
                  }}
                  maxLength={200}
                />
              </label>
              <label>
                Story đích
                <select
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                >
                  <option value="">Tách thành Story mới</option>
                  {targets.data?.items
                    .filter((s) => s.id !== coverage.data?.storyId)
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.lead.title}
                      </option>
                    ))}
                </select>
              </label>
              {targets.error && <p role="alert">{targets.error}</p>}
              <label>
                Lý do chỉnh
                <textarea
                  required
                  maxLength={500}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </label>
              <p>
                {selected.length} bài đã chọn.{" "}
                {target
                  ? "Chuyển vào Story đích đã chọn."
                  : "Tạo một Story mới chứa các bài đã chọn."}
              </p>
              <button
                className="button primary"
                disabled={busy || !selected.length || !reason.trim()}
              >
                {busy ? "Đang lưu…" : "Áp dụng chỉnh Story"}
              </button>
            </form>
          )}
        </>
      )}
    </section>
  );
}
