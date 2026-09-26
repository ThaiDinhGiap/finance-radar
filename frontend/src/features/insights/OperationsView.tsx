import { CurationHistory } from "../discovery/CurationHistory";
import { CrawlFailures } from "./CrawlFailures";
import { useState } from "react";
import { useResource } from "../../shared/useResource";
import { LoadingState } from "../../shared/LoadingState";
import { Pagination } from "../../shared/Pagination";
import { dateTime, type Article, type Page } from "../../shared/types";
import type { ChatStatus } from "../chat/types";
interface SourceStatus {
  id: string;
  name: string;
  state: string;
  lastSuccessAt: string | null;
  failures: number;
  missingPublishedAt: number;
  missingSummary: number;
  articles: number;
}
interface Snapshot {
  sampledAt: string;
  counts: Record<string, number>;
  sources: SourceStatus[];
}
const health: Record<string, string> = {
  PAUSED: "Tạm dừng",
  FAILED: "Đang lỗi",
  NEVER: "Chưa thành công",
  STALE: "Quá hạn",
  HEALTHY: "Thành công gần đây",
};
const issues: Record<string, string> = {
  MISSING_PUBLISHED: "Thiếu ngày xuất bản",
  MISSING_SUMMARY: "Thiếu tóm tắt",
  DUPLICATE_CONTENT: "Nội dung trùng chính xác",
  NOT_INDEXED: "Chưa có index hợp lệ",
  INDEX_FAILED: "Lập chỉ mục thất bại",
};
const metrics: Record<string, string> = {
  articles: "Bài trong kho",
  crawl_queued: "Crawl chờ",
  crawl_running: "Crawl đang chạy",
  crawl_overdue: "Crawl quá 10 phút",
  oldest_queue_seconds: "Chờ crawl lâu nhất (giây)",
  index_eligible: "Bài đủ điều kiện index",
  index_ready: "Index sẵn sàng",
  index_pending: "Index chờ / đang xử lý",
  index_failed: "Index thất bại",
  index_running: "Đang tạo index",
  oldest_index_seconds: "Chờ index lâu nhất (giây)",
  unclustered: "Bài chờ gom Story",
};
const qualityMetrics: Record<string, string> = {
  missing_published: "Thiếu ngày xuất bản",
  missing_summary: "Thiếu tóm tắt",
  duplicate_content_extra: "Bản nội dung trùng dư",
  duplicate_urls_skipped_7d: "URL trùng bỏ qua · 7 ngày",
  rejected_items_7d: "Mục không hợp lệ · 7 ngày",
  parse_failures_7d: "Lượt lỗi parse · 7 ngày",
  unclassified_failures_7d: "Lượt lỗi chưa phân loại · 7 ngày",
  failed_runs_7d: "Tổng lượt thất bại · 7 ngày",
  empty_runs_7d: "Lượt thành công rỗng · 7 ngày",
};
export function OperationsView({ revision }: { revision: number }) {
  const [tab, setTab] = useState("operations");
  const [retry, setRetry] = useState(0);
  const [issue, setIssue] = useState("MISSING_PUBLISHED");
  const [source, setSource] = useState("");
  const [page, setPage] = useState(0);
  const snapshot = useResource<Snapshot>(
    "/operations",
    revision + retry,
    15000,
  );
  const chat = useResource<ChatStatus>("/chat/status", revision + retry, 30000);
  const quality = useResource<Page<Article>>(
    `/operations/quality/articles?issue=${issue}${source ? `&sourceId=${source}` : ""}&page=${page}&size=20`,
    revision + retry,
    15000,
  );
  const counts = snapshot.data?.counts;
  return (
    <>
      <div className="section-heading">
        <div>
          <span className="eyebrow">VẬN HÀNH & CHẤT LƯỢNG</span>
          <h1>Operator Dashboard</h1>
          <p>Snapshot từ database; tự cập nhật mỗi 15 giây.</p>
        </div>
        <a className="button secondary" href="#runs">
          Mở nhật ký crawl
        </a>
      </div>
      <div className="discovery-actions">
        <button
          className="button secondary"
          aria-pressed={tab === "operations"}
          onClick={() => setTab("operations")}
        >
          Crawler / Indexer
        </button>
        <button
          className="button secondary"
          aria-pressed={tab === "quality"}
          onClick={() => setTab("quality")}
        >
          Data Quality
        </button>
      </div>
      {snapshot.error && (
        <p role="alert" className="error-box">
          {snapshot.error}{" "}
          <button
            className="link-button"
            onClick={() => setRetry((v) => v + 1)}
          >
            Thử lại
          </button>
        </p>
      )}
      {snapshot.loading ? (
        <LoadingState label="Đang tải vận hành…" />
      ) : (
        !snapshot.error && (
          <>
            <p className="hint">
              Lấy mẫu: {dateTime(snapshot.data?.sampledAt ?? null)}. “Thành công
              gần đây” phản ánh lịch sử crawl, không phải phép thử kết nối trực
              tiếp.
            </p>
            <dl className="metric-grid">
              {Object.entries(
                tab === "operations" ? metrics : qualityMetrics,
              ).map(([key, label]) => (
                <div key={key}>
                  <dt>{label}</dt>
                  <dd>{counts?.[key]?.toLocaleString("vi-VN") ?? "—"}</dd>
                </div>
              ))}
            </dl>
            {tab === "operations" && (
              <>
                <p className="hint">
                  Index chỉ áp dụng cho báo chí / tổ chức. Pending không gồm
                  failed; “đang tạo index” là một phần của pending. Bài
                  stale/model cũ không được tính sẵn sàng.
                </p>
                <div
                  className="table-wrap"
                  role="region"
                  aria-label="Sức khỏe nguồn"
                  tabIndex={0}
                >
                  <table>
                    <caption>Nguồn thu thập</caption>
                    <thead>
                      <tr>
                        <th scope="col">Nguồn</th>
                        <th scope="col">Trạng thái</th>
                        <th scope="col">Thành công gần nhất</th>
                        <th scope="col">Lỗi liên tiếp</th>
                        <th scope="col">Chất lượng</th>
                      </tr>
                    </thead>
                    <tbody>
                      {snapshot.data?.sources.map((s) => (
                        <tr key={s.id}>
                          <td>{s.name}</td>
                          <td>
                            <span
                              className={`badge ${s.state === "HEALTHY" ? "success" : s.state === "FAILED" ? "danger" : "pending"}`}
                            >
                              {health[s.state]}
                            </span>
                          </td>
                          <td>{dateTime(s.lastSuccessAt)}</td>
                          <td>{s.failures}</td>
                          <td>
                            <button
                              className="link-button"
                              onClick={() => {
                                setSource(s.id);
                                setPage(0);
                                setTab("quality");
                              }}
                            >
                              Xem vấn đề
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <CurationHistory revision={revision + retry} />
                <section className="digest-group">
                  <h2>Hoạt động provider AI</h2>
                  {chat.error ? (
                    <p role="alert">{chat.error}</p>
                  ) : (
                    <>
                      <p>
                        {chat.data?.configured
                          ? "Đã cấu hình AI"
                          : "Chưa có xác nhận cấu hình AI"}{" "}
                        — cấu hình không chứng minh provider khỏe.
                      </p>
                      {(["embedding", "generation"] as const).map((op) => (
                        <p key={op}>
                          {op}: {chat.data?.activity?.[op]?.status ?? "UNKNOWN"}{" "}
                          · Thành công:{" "}
                          {dateTime(
                            chat.data?.activity?.[op]?.lastSuccessAt ?? null,
                          )}
                        </p>
                      ))}
                    </>
                  )}
                </section>
              </>
            )}
            {tab === "quality" && (
              <>
                <CrawlFailures revision={revision + retry} />
                <p className="hint">
                  Thiếu trường là số hiện tại toàn kho. URL trùng là số lần bỏ
                  qua trong crawl thành công, không phải số bài trùng còn lưu.
                  Lỗi parse chỉ được phân loại từ phiên bản này; lỗi lịch sử giữ
                  là chưa phân loại. Nội dung trùng so tiêu đề + tóm tắt, không
                  phải kết luận cùng sự kiện.
                </p>
                <div className="discovery-filters">
                  <label>
                    Loại vấn đề
                    <select
                      aria-label="Loại vấn đề chất lượng"
                      value={issue}
                      onChange={(e) => {
                        setIssue(e.target.value);
                        setPage(0);
                      }}
                    >
                      {Object.entries(issues).map(([v, label]) => (
                        <option key={v} value={v}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Nguồn
                    <select
                      aria-label="Nguồn chất lượng"
                      value={source}
                      onChange={(e) => {
                        setSource(e.target.value);
                        setPage(0);
                      }}
                    >
                      <option value="">Tất cả nguồn</option>
                      {snapshot.data?.sources.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                {quality.error && (
                  <p className="error-box" role="alert">
                    {quality.error}
                  </p>
                )}
                {quality.loading ? (
                  <LoadingState label="Đang kiểm tra bài viết…" />
                ) : (
                  !quality.error && (
                    <>
                      <p>{quality.data?.total ?? 0} bài khớp vấn đề đã chọn</p>
                      {quality.data?.items.map((a) => (
                        <article className="story-member" key={a.id}>
                          <span className="eyebrow">{a.sourceName}</span>
                          <h2>
                            <a
                              href={a.url}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              {a.title}
                            </a>
                          </h2>
                          <p>{a.summary || "Không có tóm tắt"}</p>
                          <small>
                            Xuất bản: {dateTime(a.publishedAt)} · Thu thập:{" "}
                            {dateTime(a.collectedAt)}
                          </small>
                        </article>
                      ))}
                      {quality.data && (
                        <Pagination
                          page={page}
                          size={20}
                          total={quality.data.total}
                          change={setPage}
                        />
                      )}
                    </>
                  )
                )}
              </>
            )}
          </>
        )
      )}
    </>
  );
}
