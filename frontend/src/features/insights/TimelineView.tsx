import { useState } from "react";
import { useResource } from "../../shared/useResource";
import { LoadingState } from "../../shared/LoadingState";
import { Pagination } from "../../shared/Pagination";
import { dateTime, type Article, type Page } from "../../shared/types";
import {
  describeScope,
  scopeParams,
  type ReadingScope,
  type Topic,
} from "../discovery/types";
export function TimelineView({
  initialScope,
  revision,
}: {
  initialScope?: ReadingScope;
  revision: number;
}) {
  const [scope, setScope] = useState<ReadingScope>(
    initialScope
      ? { ...initialScope, days: initialScope.days || 7 }
      : { sourceId: "", language: "", days: 7 },
  );
  const [page, setPage] = useState(0);
  const [retry, setRetry] = useState(0);
  const topics = useResource<Topic[]>("/topics", revision + retry);
  const params = scopeParams(scope);
  params.set("page", String(page));
  params.set("size", "20");
  const { data, error, loading } = useResource<Page<Article>>(
    `/timeline?${params}`,
    revision + retry,
    30000,
  );
  const change = (next: ReadingScope) => {
    setScope(next);
    setPage(0);
  };
  return (
    <>
      <div className="section-heading">
        <div>
          <span className="eyebrow">DIỄN BIẾN</span>
          <h1>Timeline</h1>
          <p>
            Các cập nhật theo thời gian, từ cũ đến mới; mỗi mốc dẫn về bài gốc.
          </p>
        </div>
      </div>
      <div className="discovery-filters">
        <label>
          Topic / Entity
          <select
            aria-label="Chủ đề Timeline"
            value={scope.filter?.topicIds?.[0] ?? ""}
            onChange={(e) =>
              change({
                ...scope,
                filter: {
                  ...scope.filter,
                  topicIds: e.target.value ? [e.target.value] : [],
                },
              })
            }
          >
            <option value="">Tất cả chủ đề</option>
            {topics.data?.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Khoảng thời gian
          <select
            aria-label="Thời gian Timeline"
            value={scope.days}
            onChange={(e) => change({ ...scope, days: Number(e.target.value) })}
          >
            <option value={1}>24 giờ</option>
            <option value={7}>7 ngày</option>
            <option value={30}>30 ngày</option>
            <option value={3650}>10 năm</option>
          </select>
        </label>
        <button
          className="button secondary"
          onClick={() => change({ sourceId: "", language: "", days: 7 })}
        >
          Xóa phạm vi Timeline
        </button>
      </div>
      <p className="hint">{describeScope(scope)}</p>
      {(error || topics.error) && (
        <p className="error-box" role="alert">
          {error || topics.error}{" "}
          <button
            className="link-button"
            onClick={() => setRetry((v) => v + 1)}
          >
            Thử lại
          </button>
        </p>
      )}
      {loading ? (
        <LoadingState label="Đang tải Timeline…" />
      ) : (
        !error && (
          <>
            {!data?.items.length && (
              <div className="empty-state">
                <h2>Chưa có cập nhật trong phạm vi này</h2>
                <p>Thử đổi chủ đề hoặc mở rộng thời gian.</p>
              </div>
            )}
            <ol className="timeline-list">
              {data?.items.map((a) => (
                <li key={a.id}>
                  <time dateTime={a.publishedAt || a.collectedAt}>
                    {dateTime(a.publishedAt || a.collectedAt)}
                  </time>
                  <div>
                    <span className="eyebrow">{a.sourceName}</span>
                    <h2>
                      <a href={a.url} target="_blank" rel="noopener noreferrer">
                        {a.title}
                      </a>
                    </h2>
                    <p>{a.summary || "Nguồn không cung cấp tóm tắt."}</p>
                    <small>
                      {a.publishedAt
                        ? "Theo ngày xuất bản"
                        : "Thiếu ngày xuất bản — dùng ngày thu thập"}
                    </small>
                  </div>
                </li>
              ))}
            </ol>
            {data && (
              <Pagination
                page={page}
                size={20}
                total={data.total}
                change={setPage}
              />
            )}
          </>
        )
      )}
    </>
  );
}
