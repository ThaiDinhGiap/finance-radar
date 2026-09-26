import { StoryTools } from "./StoryTools";
import { recordRead } from "./usePersonalFeed";
import { useState } from "react";
import { Modal } from "../../shared/Modal";
import { Pagination } from "../../shared/Pagination";
import { LoadingState } from "../../shared/LoadingState";
import { useResource } from "../../shared/useResource";
import { dateTime, type Article, type Page } from "../../shared/types";
import type { Story, ReadingScope } from "./types";
export function StoryDialog({
  story,
  close,
  openChat,
  openTimeline,
}: {
  story: Story;
  close: () => void;
  openChat: (scope: ReadingScope) => void;
  openTimeline: (scope: ReadingScope) => void;
}) {
  const [mode, setMode] = useState<"articles" | "coverage" | "curation">(
    "articles",
  );
  const [page, setPage] = useState(0);
  const [retry, setRetry] = useState(0);
  const { data, error, loading } = useResource<Page<Article>>(
    `/articles?storyId=${story.id}&page=${page}&size=15`,
    retry,
    15000,
  );
  return (
    <Modal title="Các bài trong Story" close={close}>
      <div className="article-detail">
        <h2>{story.lead.title}</h2>
        <p className="hint">
          Story có thể được gom tự động hoặc chỉnh thủ công. Hãy đối chiếu các
          bài gốc. Danh sách dưới đây gồm mọi bài trong nhóm, không giữ bộ lọc
          của feed. Bài gốc vẫn được lưu riêng.
        </p>
        <button
          className="button primary"
          onClick={() =>
            openChat({
              sourceId: "",
              language: "",
              days: 3650,
              filter: { storyId: story.id },
              label: story.lead.title,
            })
          }
        >
          Hỏi AI về Story này
        </button>
        <button
          className="button secondary"
          onClick={() =>
            openTimeline({
              sourceId: "",
              language: "",
              days: 7,
              filter: { storyId: story.id },
              label: story.lead.title,
            })
          }
        >
          Timeline Story
        </button>
        <div className="discovery-actions">
          {(
            [
              ["articles", "Bài trong Story"],
              ["coverage", "Compare Coverage"],
              ["curation", "Chỉnh Story"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              className="button secondary"
              aria-pressed={mode === value}
              onClick={() => setMode(value)}
            >
              {label}
            </button>
          ))}
        </div>
        {mode !== "articles" && (
          <StoryTools
            storyId={story.id}
            mode={mode}
            changed={() => setRetry((v) => v + 1)}
          />
        )}
        {mode === "articles" && (
          <>
            {error && (
              <p className="error-box" role="alert">
                {error}{" "}
                <button
                  className="link-button"
                  onClick={() => setRetry((v) => v + 1)}
                >
                  Thử lại
                </button>
              </p>
            )}
            {loading ? (
              <LoadingState label="Đang tải Story…" />
            ) : (
              !error && (
                <>
                  <p>{data?.total ?? 0} bài trong Story</p>
                  {!data?.items.length && (
                    <p>Story không còn bài. Hãy đóng và làm mới dòng tin.</p>
                  )}
                  {data?.items.map((article) => (
                    <article className="story-member" key={article.id}>
                      <span className="eyebrow">{article.sourceName}</span>
                      <h3>
                        <a
                          href={article.url}
                          onClick={() => recordRead(article.id)}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {article.title}
                        </a>
                      </h3>
                      <p>{article.summary}</p>
                      <small>
                        {dateTime(article.publishedAt || article.collectedAt)}
                      </small>
                    </article>
                  ))}
                  {data && (
                    <Pagination
                      page={page}
                      size={15}
                      total={data.total}
                      change={setPage}
                    />
                  )}
                </>
              )
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
