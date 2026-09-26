import { useState } from "react";
import { useResource } from "../../shared/useResource";
import { LoadingState } from "../../shared/LoadingState";
import { dateTime, type Article } from "../../shared/types";
import type { ReadingScope } from "../discovery/types";
interface DigestItem {
  storyId: string;
  topic: string;
  lead: Article;
  articleCount: number;
  sourceCount: number;
  citations: Article[];
}
interface Digest {
  from: string;
  until: string;
  totalStories: number;
  items: DigestItem[];
}
export function DigestView({
  revision,
  openTimeline,
  openChat,
}: {
  revision: number;
  openTimeline: (s: ReadingScope) => void;
  openChat: (s: ReadingScope) => void;
}) {
  const [date, setDate] = useState(() =>
    new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(
      new Date(),
    ),
  );
  const [period, setPeriod] = useState("day");
  const [retry, setRetry] = useState(0);
  const { data, error, loading } = useResource<Digest>(
    `/digest?date=${date}&period=${period}`,
    revision + retry,
  );
  const groups = new Map<string, DigestItem[]>();
  data?.items.forEach((item) =>
    groups.set(item.topic, [...(groups.get(item.topic) ?? []), item]),
  );
  return (
    <>
      <div className="section-heading">
        <div>
          <span className="eyebrow">BẢN TIN TỔNG HỢP</span>
          <h1>Daily Digest</h1>
          <p>
            Nhóm theo chủ đề, ưu tiên Story có nhiều nguồn đưa tin; tối đa 30
            Story.
          </p>
        </div>
      </div>
      <div className="discovery-filters">
        <label>
          Ngày kết thúc
          <input
            aria-label="Ngày Digest"
            type="date"
            value={date}
            onChange={(e) => {
              if (e.target.value) setDate(e.target.value);
            }}
          />
        </label>
        <label>
          Kỳ tổng hợp
          <select
            aria-label="Kỳ Digest"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
          >
            <option value="day">Theo ngày</option>
            <option value="week">7 ngày kết thúc vào ngày chọn</option>
          </select>
        </label>
      </div>
      <p className="hint">
        Múi giờ Việt Nam. Trích tóm tắt từ bài đại diện, không phải nhận định do
        AI tạo. Mức độ đưa tin không đồng nghĩa mức độ quan trọng hay độ tin
        cậy.
      </p>
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
        <LoadingState label="Đang tổng hợp Digest…" />
      ) : (
        !error && (
          <>
            <p>
              {data?.items.length ?? 0} / {data?.totalStories ?? 0} Story trong
              kỳ · Chỉ báo chí và tổ chức kinh tế
            </p>
            {!data?.items.length && (
              <div className="empty-state">
                <h2>Chưa có tin trong kỳ này</h2>
              </div>
            )}
            {[...groups].map(([topic, items]) => (
              <section className="digest-group" key={topic}>
                <h2>{topic}</h2>
                {items.map((item) => {
                  const scope: ReadingScope = {
                    sourceId: "",
                    language: "",
                    days: 3650,
                    filter: { storyId: item.storyId },
                    label: item.lead.title,
                  };
                  return (
                    <article className="story-member" key={item.storyId}>
                      <h3>{item.lead.title}</h3>
                      <p>
                        {item.lead.summary ||
                          "Bài đại diện chưa có tóm tắt; hãy mở nguồn để đọc."}
                      </p>
                      <p className="hint">
                        {item.sourceCount} nguồn · {item.articleCount} bài ·{" "}
                        {dateTime(
                          item.lead.publishedAt || item.lead.collectedAt,
                        )}
                      </p>
                      <ol
                        className="citation-list"
                        aria-label={`Nguồn cho ${item.lead.title}`}
                      >
                        {item.citations.map((a) => (
                          <li key={a.id}>
                            <a
                              href={a.url}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              {a.sourceName} — {a.title}
                            </a>
                          </li>
                        ))}
                      </ol>
                      {item.articleCount > item.citations.length && (
                        <p className="hint">
                          Hiển thị {item.citations.length} bài nguồn mới nhất
                          trong kỳ.
                        </p>
                      )}
                      <div className="discovery-actions">
                        <button
                          className="link-button"
                          onClick={() => openTimeline(scope)}
                        >
                          Xem Timeline Story
                        </button>
                        <button
                          className="link-button"
                          onClick={() => openChat(scope)}
                        >
                          Hỏi AI về Story
                        </button>
                      </div>
                    </article>
                  );
                })}
              </section>
            ))}
          </>
        )
      )}
    </>
  );
}
