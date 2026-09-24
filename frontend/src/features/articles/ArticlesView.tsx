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
import { Modal } from "../../shared/Modal";
export function ArticlesView({
  sources,
  revision,
  openChat,
  openSources,
}: {
  sources: Source[];
  revision: number;
  openChat: () => void;
  openSources: () => void;
}) {
  const [layout, setLayout] = useState<"editorial" | "compact">("editorial");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [source, setSource] = useState("");
  const [language, setLanguage] = useState("");
  const [category, setCategory] = useState("");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Article | null>(null);
  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(search);
      setPage(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);
  const params = new URLSearchParams({
    q: query,
    language,
    category,
    page: String(page),
    size: "15",
  });
  if (source) params.set("sourceId", source);
  const { data, error, loading } = useResource<Page<Article>>(
    `/articles?${params}`,
    revision,
    15000,
  );
  function reset() {
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
          <span className="eyebrow">ĐỌC THỊ TRƯỜNG, HIỂU CHUYỂN ĐỘNG</span>
          <h1>Nhịp đập kinh tế.</h1>
          <p>Theo dõi những chuyển động từ Việt Nam đến thế giới.</p>
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
            </div>
            <div className="filter-row">
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
                className="text-button"
                onClick={reset}
                disabled={!search && !source && !language && !category}
              >
                Xóa bộ lọc
              </button>
            </div>
          </div>
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
          <div className="list-heading">
            <div>
              <h2>
                {query || source || language || category
                  ? "Kết quả tra cứu"
                  : "Mới trên Radar"}
              </h2>
              <span>
                {data?.total.toLocaleString("vi-VN") ?? "—"} bài viết · Mới thu
                thập trước
              </span>
            </div>
            <div className="view-controls" aria-label="Kiểu hiển thị">
              <button
                className="icon-button"
                aria-label="Bố cục báo"
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
              {error}
            </div>
          )}
          {loading ? (
            <div className="empty-state" role="status">
              Đang tải dòng thông tin…
            </div>
          ) : !data?.items.length && !error ? (
            <div className="empty-state">
              <Newspaper size={34} />
              <h3>Chưa có bài viết phù hợp</h3>
              <p>
                Thử thay đổi bộ lọc hoặc thu thập dữ liệu tại mục Nguồn dữ liệu.
              </p>
            </div>
          ) : (
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
                        onClick={() => setSelected(a)}
                      >
                        {a.title}
                      </button>
                    </h3>
                    <p className="article-summary">
                      {a.summary ||
                        "Nguồn không cung cấp đoạn tóm tắt. Mở bài gốc để đọc thêm."}
                    </p>
                    <div className="article-footer">
                      <span>
                        {a.publishedAt ? "Đăng" : "Thu thập"}{" "}
                        {dateTime(a.publishedAt || a.collectedAt)}
                      </span>
                      <a href={a.url} target="_blank" rel="noopener noreferrer">
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
          <section className="reader-note">
            <span className="eyebrow">MỘT GÓC NHÌN RỘNG HƠN</span>
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
            <button className="button primary" onClick={openChat}>
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
            <button className="text-button rail-link" onClick={openSources}>
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
            <a
              className="button primary"
              href={selected.url}
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
