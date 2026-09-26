import { useState } from "react";
import { useLibrary } from "./useLibrary";
import { useResource } from "../../shared/useResource";
import { LoadingState } from "../../shared/LoadingState";
import { Pagination } from "../../shared/Pagination";
import { StoryDialog } from "./StoryDialog";
import { watchScope, type Topic, type Story, type ReadingScope } from "./types";
import { recordRead, usePersonalFeed } from "./usePersonalFeed";
export function PersonalFeedView({
  revision,
  openChat,
  openTimeline,
}: {
  revision: number;
  openChat: (s: ReadingScope) => void;
  openTimeline: (s: ReadingScope) => void;
}) {
  const library = useLibrary();
  const topics = useResource<Topic[]>("/topics", revision);
  const [story, setStory] = useState<Story | null>(null);
  const choices = [
    ...library.watches.map((w) => ({
      id: `watch:${w.id}`,
      name: `Watchlist: ${w.name}`,
      scope: watchScope(w),
    })),
    ...library.searches.map((s) => ({
      id: `search:${s.id}`,
      name: `Tìm kiếm: ${s.name}`,
      scope: s.scope,
    })),
    ...(topics.data ?? []).map((t) => ({
      id: `topic:${t.id}`,
      name: t.name,
      scope: {
        sourceId: "",
        language: "",
        days: 0,
        filter: { topicIds: [t.id] },
      },
    })),
  ];
  const feed = usePersonalFeed(choices, revision);
  const p = feed.preferences;
  return (
    <>
      <div className="section-heading">
        <div>
          <span className="eyebrow">DÀNH CHO BẠN</span>
          <h1>Personalized Feed</h1>
          <p>
            Ưu tiên mối quan tâm đã chọn, gom mỗi Story một đại diện và giải
            thích lý do xuất hiện.
          </p>
        </div>
      </div>
      <details className="digest-group" open>
        <summary>Tùy chỉnh mối quan tâm</summary>
        <div className="interest-grid">
          {choices.map((c) => (
            <label key={c.id}>
              <input
                type="checkbox"
                checked={p.selected.includes(c.id)}
                onChange={(e) =>
                  feed.update({
                    ...p,
                    selected: e.target.checked
                      ? [...p.selected, c.id]
                      : p.selected.filter((id) => id !== c.id),
                  })
                }
              />
              {c.name}
            </label>
          ))}
        </div>
        <label>
          <input
            type="checkbox"
            checked={p.history}
            onChange={(e) =>
              feed.update({
                ...p,
                history: e.target.checked,
                reads: e.target.checked ? p.reads : [],
              })
            }
          />{" "}
          Dùng và lưu lịch sử mở bài trên trình duyệt này
        </label>
        <div className="discovery-actions">
          <button
            className="button secondary"
            onClick={() => feed.update({ ...p, reads: [] })}
          >
            Xóa lịch sử đọc ({p.reads.length})
          </button>
          <label>
            Khoảng thời gian feed
            <select
              value={p.days}
              onChange={(e) =>
                feed.update({ ...p, days: Number(e.target.value) })
              }
            >
              <option value={1}>24 giờ</option>
              <option value={7}>7 ngày</option>
              <option value={30}>30 ngày</option>
            </select>
          </label>
        </div>
        <p className="hint">
          Mỗi điều kiện khớp +10 điểm; chủ đề từng đọc +3; bài chưa đọc +1. Cùng
          điểm ưu tiên tin mới. Tin không khớp vẫn nằm cuối feed. Tối đa 30 lựa
          chọn và 200 bài trong lịch sử; dữ liệu cá nhân chỉ lưu tại trình
          duyệt, gửi tới API khi xếp hạng.
        </p>
      </details>
      {(feed.error || topics.error || library.error) && (
        <p className="error-box" role="alert">
          {feed.error || topics.error || library.error}
        </p>
      )}
      {feed.loading ? (
        <LoadingState label="Đang xếp dòng tin…" />
      ) : (
        !feed.error && (
          <>
            {feed.data?.items.map((item) => (
              <article className="story-member" key={item.storyId}>
                <span className="eyebrow">
                  {item.article.sourceName} · {item.read ? "Đã mở" : "Chưa mở"}
                </span>
                <h2>
                  <a
                    href={item.article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => recordRead(item.article.id)}
                  >
                    {item.article.title}
                  </a>
                </h2>
                <p>{item.article.summary}</p>
                <p className="hint">
                  {item.reasons.join(" · ")} · {item.score} điểm
                </p>
                <button
                  className="link-button"
                  onClick={() =>
                    setStory({
                      id: item.storyId,
                      lead: item.article,
                      matchingArticles: 1,
                      totalArticles: 1,
                      sources: 1,
                      lastCollectedAt: item.article.collectedAt,
                      clustered: true,
                    })
                  }
                >
                  Đối chiếu Story
                </button>
              </article>
            ))}
            {!feed.data?.items.length && (
              <p>Chưa có tin trong khoảng thời gian này.</p>
            )}
            {feed.data && (
              <Pagination
                page={feed.page}
                size={15}
                total={feed.data.total}
                change={feed.setPage}
              />
            )}
          </>
        )
      )}
      {story && (
        <StoryDialog
          story={story}
          close={() => setStory(null)}
          openChat={openChat}
          openTimeline={openTimeline}
        />
      )}
    </>
  );
}
