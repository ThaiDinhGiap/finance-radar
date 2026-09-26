import { recordRead } from "../discovery/usePersonalFeed";
import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  Search,
  Newspaper,
  Globe2,
  ArrowRight,
  BookOpen,
  LayoutGrid,
  List,
  X,
  SlidersHorizontal,
} from "lucide-react";
import { useResource } from "../../shared/useResource";
import {
  categories,
  dateTime,
  type Article,
  type Page,
  type Source,
} from "../../shared/types";
import { Pagination } from "../../shared/Pagination";
import { LoadingState } from "../../shared/LoadingState";
import { Modal } from "../../shared/Modal";
import { StoryDialog } from "../discovery/StoryDialog";
import { LibraryPanel } from "../discovery/LibraryPanel";
import {
  describeScope,
  scopeParams,
  type ArticleFilter,
  type ReadingScope,
  type Topic,
  type Story,
} from "../discovery/types";
export function ArticlesView({
  sources,
  revision,
  openChat,
  openSources,
  openTimeline,
}: {
  sources: Source[];
  revision: number;
  openChat: (scope?: ReadingScope) => void;
  openSources: () => void;
  openTimeline: (scope: ReadingScope) => void;
}) {
  const [grouped, setGrouped] = useState(true);
  const [selectedStory, setSelectedStory] = useState<Story | null>(null);
  const [layout, setLayout] = useState<"editorial" | "compact">("compact");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [source, setSource] = useState("");
  const [language, setLanguage] = useState("");
  const [category, setCategory] = useState("");
  const [extra, setExtra] = useState<ArticleFilter>({});
  const [days, setDays] = useState(0);
  const [scopeLabel, setScopeLabel] = useState("");
  const [story, setStory] = useState<string[]>([]);
  const topics = useResource<Topic[]>("/topics", revision);
  const readingScope: ReadingScope = {
    sourceId: source,
    language,
    days,
    filter: { ...extra, q: search, category },
    label: scopeLabel,
  };
  function applyScope(next: ReadingScope) {
    setSearch(next.filter?.q ?? "");
    setQuery(next.filter?.q ?? "");
    setSource(next.sourceId);
    setLanguage(next.language);
    setDays(next.days);
    setCategory(next.filter?.category ?? "");
    setExtra(next.filter ?? {});
    setScopeLabel(next.label ?? "");
    setPage(0);
    setStory([]);
  }
  const [retry, setRetry] = useState(0);
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Article | null>(null);
  useEffect(() => {
    if (search === query) return;
    const timer = setTimeout(() => {
      setQuery(search);
      setPage(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [search, query]);
  const params = scopeParams({
    ...readingScope,
    filter: { ...extra, q: query, category },
  });
  const pagination = new URLSearchParams({
    q: query,
    language,
    category,
    page: String(page),
    size: "15",
  });
  pagination.forEach((value, key) => params.set(key, value));
  const {
    data: response,
    error,
    loading,
  } = useResource<Page<Article | Story>>(
    `/${grouped ? "stories" : "articles"}?${params}`,
    revision + retry,
    15000,
  );
  const data = response && {
    ...response,
    items: response.items.map((item) => ("lead" in item ? item.lead : item)),
  };
  const groups = new Map(
    response?.items.flatMap((item) =>
      "lead" in item ? [[item.lead.id, item] as const] : [],
    ) ?? [],
  );
  function reset() {
    setExtra({});
    setDays(0);
    setScopeLabel("");
    setStory([]);
    setSearch("");
    setQuery("");
    setSource("");
    setLanguage("");
    setCategory("");
    setPage(0);
  }
  return (
    <>
      <div className="section-heading">
        <div>
          <span className="eyebrow">KHÁM PHÁ</span>
          <h1>Dòng thông tin</h1>
          <p>Tin kinh tế và tài chính từ các nguồn bạn theo dõi.</p>
        </div>
        <span className="edition">
          <Globe2 size={16} /> VIỆT NAM & QUỐC TẾ
        </span>
      </div>
      <div className="news-layout">
        <section className="news-main" aria-label="Dòng bài viết">
          <div className="filter-panel">
            <div className="search-field">
              <Search size={19} />
              <input
                aria-label="Tìm kiếm bài viết"
                placeholder="Tìm chủ đề, doanh nghiệp, từ khóa…"
                value={search}
                maxLength={200}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button
                  className="icon-button clear-search"
                  onClick={() => setSearch("")}
                  aria-label="Xóa từ khóa"
                >
                  <X size={15} />
                </button>
              )}
              <button
                className="mobile-filter-toggle icon-button"
                aria-label="Bộ lọc bài viết"
                aria-expanded={filtersOpen}
                aria-controls="article-filters"
                onClick={() => setFiltersOpen(!filtersOpen)}
              >
                <SlidersHorizontal size={18} />
              </button>
            </div>
            <div
              id="article-filters"
              className={`filter-row ${filtersOpen ? "filters-open" : "filters-collapsed"}`}
            >
              <label>
                <span>Nguồn tin</span>
                <select
                  aria-label="Nguồn tin"
                  value={source}
                  onChange={(e) => {
                    setSource(e.target.value);
                    setPage(0);
                  }}
                >
                  <option value="">Tất cả nguồn</option>
                  {sources.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Ngôn ngữ</span>
                <select
                  aria-label="Ngôn ngữ"
                  value={language}
                  onChange={(e) => {
                    setLanguage(e.target.value);
                    setPage(0);
                  }}
                >
                  <option value="">Tất cả ngôn ngữ</option>
                  <option value="vi">Tiếng Việt</option>
                  <option value="en">Tiếng Anh</option>
                  <option value="other">Khác</option>
                </select>
              </label>
              <button
                className="link-button"
                onClick={reset}
                disabled={
                  !search &&
                  !source &&
                  !language &&
                  !category &&
                  !days &&
                  !Object.keys(extra).length
                }
              >
                Xóa bộ lọc
              </button>
            </div>
          </div>
          <div className="discovery-filters">
            <label>
              Địa danh trong tin
              <input
                maxLength={100}
                value={extra.location ?? ""}
                placeholder="Nghệ An"
                onChange={(e) => {
                  setExtra({ ...extra, location: e.target.value });
                  setPage(0);
                }}
              />
            </label>
            <label>
              Thời gian
              <select
                aria-label="Thời gian"
                value={days}
                onChange={(e) => {
                  setDays(Number(e.target.value));
                  setPage(0);
                }}
              >
                <option value={0}>Mọi thời điểm</option>
                <option value={1}>24 giờ</option>
                <option value={7}>7 ngày gần nhất</option>
                <option value={30}>30 ngày gần nhất</option>
                <option value={3650}>10 năm gần nhất</option>
              </select>
            </label>
            <label>
              Topic / Entity
              <select
                value={extra.topicIds?.length === 1 ? extra.topicIds[0] : ""}
                onChange={(e) => {
                  setExtra({
                    ...extra,
                    topicIds: e.target.value ? [e.target.value] : [],
                  });
                  setPage(0);
                }}
              >
                <option value="">
                  {(extra.topicIds?.length ?? 0) > 1
                    ? "Nhiều mục trong Watchlist"
                    : "Tất cả chủ đề"}
                </option>
                {topics.data?.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} · {t.articles} tin
                  </option>
                ))}
              </select>
            </label>
          </div>
          {topics.error && (
            <p className="error-box" role="alert">
              {topics.error}
            </p>
          )}
          <p className="hint">
            Nhận diện tên/bí danh trong tiêu đề và tóm tắt; có thể bỏ sót hoặc
            nhầm đối tượng. Thời gian dùng ngày xuất bản, nếu thiếu dùng ngày
            thu thập.
          </p>
          <div className="discovery-actions">
            <button
              className="button secondary"
              onClick={() => openTimeline(readingScope)}
            >
              Xem Timeline phạm vi này
            </button>
            <span>{describeScope(readingScope)}</span>
            <button
              className="button secondary"
              onClick={() => openChat(readingScope)}
            >
              Hỏi AI trong phạm vi này
            </button>
            {!!story.length && (
              <>
                <button
                  className="button secondary"
                  onClick={() =>
                    openChat({
                      sourceId: "",
                      language: "",
                      days: 3650,
                      filter: { articleIds: story },
                      label: "Tập bài đã chọn",
                    })
                  }
                >
                  Hỏi AI về {story.length} bài đã chọn
                </button>
                <button className="link-button" onClick={() => setStory([])}>
                  Bỏ chọn bài
                </button>
              </>
            )}
          </div>
          {(source || language) && (
            <div className="active-filters">
              <span>
                Đang lọc:{" "}
                {[
                  sources.find((s) => s.id === source)?.name,
                  language === "vi"
                    ? "Tiếng Việt"
                    : language === "en"
                      ? "Tiếng Anh"
                      : language === "other"
                        ? "Ngôn ngữ khác"
                        : "",
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
              <button className="link-button" onClick={reset}>
                Xóa bộ lọc
              </button>
            </div>
          )}
          <div className="category-tabs" aria-label="Loại thông tin">
            <button
              className={!category ? "selected" : ""}
              aria-pressed={!category}
              onClick={() => {
                setCategory("");
                setPage(0);
              }}
            >
              Tất cả
            </button>
            {Object.entries(categories).map(([key, label]) => (
              <button
                key={key}
                className={category === key ? "selected" : ""}
                aria-pressed={category === key}
                onClick={() => {
                  setCategory(key);
                  setPage(0);
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="discovery-actions" aria-label="Gom nội dung trùng">
            <button
              className="button secondary"
              aria-pressed={grouped}
              onClick={() => {
                setGrouped(true);
                setPage(0);
              }}
            >
              Gom theo Story
            </button>
            <button
              className="button secondary"
              aria-pressed={!grouped}
              onClick={() => {
                setGrouped(false);
                setPage(0);
              }}
            >
              Từng bài viết
            </button>
            {grouped && (
              <span className="hint">
                Mỗi nhóm hiện một bài đại diện khớp bộ lọc. Tin mới được gom
                nền.
              </span>
            )}
          </div>
          <div className="list-heading">
            <div>
              <h2>
                {query || source || language || category
                  ? "Kết quả tra cứu"
                  : "Mới trên Radar"}
              </h2>
              <span>
                {data?.total.toLocaleString("vi-VN") ?? "—"}{" "}
                {grouped ? "Story" : "bài viết"} · Mới thu thập trước
              </span>
            </div>
            <div className="view-controls" aria-label="Kiểu hiển thị">
              <button
                className="icon-button"
                aria-label="Bố cục thẻ"
                aria-pressed={layout === "editorial"}
                onClick={() => setLayout("editorial")}
              >
                <LayoutGrid size={16} />
              </button>
              <button
                className="icon-button"
                aria-label="Danh sách gọn"
                aria-pressed={layout === "compact"}
                onClick={() => setLayout("compact")}
              >
                <List size={17} />
              </button>
            </div>
          </div>
          {error && (
            <div role="alert" className="error-box">
              {error}{" "}
              <button
                className="link-button"
                onClick={() => setRetry((v) => v + 1)}
              >
                Thử lại
              </button>
            </div>
          )}
          {loading ? (
            <LoadingState label="Đang tải dòng thông tin…" />
          ) : !data?.items.length && !error ? (
            <div className="empty-state">
              <Newspaper size={34} />
              <h3>Chưa có bài viết phù hợp</h3>
              <p>Thử mở rộng bộ lọc hoặc kiểm tra nguồn thu thập của bạn.</p>
              <button
                className="button secondary"
                onClick={
                  search || source || language || category ? reset : openSources
                }
              >
                {search || source || language || category
                  ? "Xóa bộ lọc"
                  : "Quản lý nguồn tin"}
              </button>
            </div>
          ) : error ? null : (
            <div className={`article-list ${layout}`}>
              {data?.items.map((a, index) => (
                <article
                  key={a.id}
                  className={`article-row ${index === 0 ? "lead-article" : ""}`}
                >
                  <div className="article-number">
                    {String(page * 15 + index + 1).padStart(2, "0")}
                  </div>
                  <div className="article-content">
                    <div className="article-meta">
                      <input
                        type="checkbox"
                        aria-label={`Chọn bài: ${a.title}`}
                        checked={story.includes(a.id)}
                        disabled={!story.includes(a.id) && story.length >= 100}
                        onChange={(e) =>
                          setStory(
                            e.target.checked
                              ? [...story, a.id]
                              : story.filter((id) => id !== a.id),
                          )
                        }
                      />
                      <span className="source-name">{a.sourceName}</span>
                      <span className="meta-dot">·</span>
                      <span>{a.language.toUpperCase()}</span>
                      <span className="category-tag">
                        {categories[a.category]}
                      </span>
                    </div>
                    <h3>
                      <button
                        className="article-title"
                        onClick={() => {
                          recordRead(a.id);
                          setSelected(a);
                        }}
                      >
                        {a.title}
                      </button>
                    </h3>
                    <p className="article-summary">
                      {a.summary ||
                        "Nguồn không cung cấp đoạn tóm tắt. Mở bài gốc để đọc thêm."}
                    </p>
                    {grouped && groups.has(a.id) && (
                      <div className="discovery-actions">
                        <button
                          className="link-button"
                          onClick={() => setSelectedStory(groups.get(a.id)!)}
                        >
                          Xem Story · {groups.get(a.id)!.totalArticles} bài
                        </button>
                        <span className="hint">
                          {groups.get(a.id)!.matchingArticles} bài khớp ·{" "}
                          {groups.get(a.id)!.sources} nguồn khớp
                          {!groups.get(a.id)!.clustered
                            ? " · Chờ phân nhóm"
                            : ""}
                        </span>
                      </div>
                    )}
                    <div className="article-footer">
                      <span>
                        {a.publishedAt ? "Đăng" : "Thu thập"}{" "}
                        {dateTime(a.publishedAt || a.collectedAt)}
                      </span>
                      <a
                        href={a.url}
                        onClick={() => recordRead(a.id)}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Đọc tại nguồn <ArrowUpRight size={14} />
                      </a>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
          {data && !loading && (
            <Pagination
              page={page}
              size={15}
              total={data.total}
              change={setPage}
            />
          )}
        </section>
        <aside className="news-rail" aria-label="Công cụ và nguồn đọc tin">
          <LibraryPanel
            scope={readingScope}
            apply={applyScope}
            sources={sources}
            topics={topics.data ?? []}
          />
          <section className="reader-note">
            <span className="eyebrow">TRỢ LÝ ĐỌC TIN</span>
            <BookOpen size={30} strokeWidth={1.2} />
            <h2>
              Từ dòng tin
              <br />
              đến câu trả lời.
            </h2>
            <p>
              Hỏi AI từ kho tin đã thu thập. Đọc lời giải thích cùng dẫn chứng
              để tự mình đối chiếu.
            </p>
            <button
              className="button primary"
              onClick={() => openChat(readingScope)}
            >
              Bắt đầu một câu hỏi <ArrowUpRight size={16} />
            </button>
            <span className="rail-caption">
              Dựa trên báo chí & tổ chức kinh tế
            </span>
          </section>
          <section className="rail-sources">
            <div className="rail-heading">
              <h2>Nguồn trên Radar</h2>
              <span>{sources.length}</span>
            </div>
            <p className="hint">Chọn một nguồn để đọc dòng tin riêng.</p>
            {sources.slice(0, 6).map((s, i) => (
              <button
                key={s.id}
                className="rail-source"
                aria-pressed={source === s.id}
                onClick={() => {
                  setSource(source === s.id ? "" : s.id);
                  setPage(0);
                }}
              >
                <span className="rail-index">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span>
                  <strong>{s.name}</strong>
                  <small>
                    {categories[s.category]} · {s.language.toUpperCase()}
                  </small>
                </span>
                <ArrowUpRight size={15} />
              </button>
            ))}
            <button className="link-button rail-link" onClick={openSources}>
              Quản lý tất cả nguồn <ArrowRight size={15} />
            </button>
          </section>
          <section className="reading-guide">
            <span className="eyebrow">ĐỌC CÓ ĐỐI CHIẾU</span>
            <p>
              Mỗi bản tin là một góc nhìn. Mở bài gốc để xem đầy đủ nội dung và
              bối cảnh.
            </p>
            <span>FINANCE RADAR — READING ROOM</span>
          </section>
        </aside>
      </div>
      {selectedStory && (
        <StoryDialog
          key={selectedStory.id}
          story={selectedStory}
          openTimeline={openTimeline}
          close={() => setSelectedStory(null)}
          openChat={openChat}
        />
      )}
      {selected && (
        <Modal title="Chi tiết bài viết" close={() => setSelected(null)}>
          <div className="article-detail">
            <span className="eyebrow">{selected.sourceName}</span>
            <h2>{selected.title}</h2>
            <p>{selected.summary || "Nguồn không cung cấp đoạn tóm tắt."}</p>
            <dl>
              <dt>Ngày xuất bản</dt>
              <dd>{dateTime(selected.publishedAt)}</dd>
              <dt>Thời điểm thu thập</dt>
              <dd>{dateTime(selected.collectedAt)}</dd>
              <dt>Phân loại</dt>
              <dd>
                {categories[selected.category]} · {selected.region}
              </dd>
            </dl>
            <button
              className="button secondary"
              onClick={() =>
                openChat({
                  sourceId: "",
                  language: "",
                  days: 3650,
                  filter: { articleIds: [selected.id] },
                  label: selected.title,
                })
              }
            >
              Hỏi AI về bài này
            </button>
            <a
              className="button primary"
              href={selected.url}
              onClick={() => recordRead(selected.id)}
              target="_blank"
              rel="noopener noreferrer"
            >
              Đọc bài viết gốc <ArrowUpRight size={16} />
            </a>
            <p className="hint">
              Nội dung tóm tắt do nguồn cung cấp. Quan điểm trên diễn đàn và
              mạng xã hội chưa được xác minh.
            </p>
          </div>
        </Modal>
      )}
    </>
  );
}
