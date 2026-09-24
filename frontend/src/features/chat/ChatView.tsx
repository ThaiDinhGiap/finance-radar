import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowUpRight,
  BookOpen,
  MessageSquare,
  Search,
  Send,
  ShieldCheck,
  Trash2,
  ChevronDown,
} from "lucide-react";
import { useResource } from "../../shared/useResource";
import { dateTime, type Article, type Source } from "../../shared/types";
import { Modal } from "../../shared/Modal";
import { useChat } from "./useChat";
import type { ChatScope, ChatStatus, ChatTurn } from "./types";
const prompts = [
  "Giá vàng trong các bản tin gần đây có diễn biến gì?",
  "Các báo đang nói gì về lãi suất?",
  "Có thông tin gì mới về VinFast?",
];
export function ChatView({
  sources,
  revision,
}: {
  sources: Source[];
  revision: number;
}) {
  const status = useResource<ChatStatus>("/chat/status", revision, 30000);
  const { turns, busy, send, clear } = useChat();
  const transcript = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (transcript.current)
      transcript.current.scrollTop = transcript.current.scrollHeight;
  }, [turns, busy]);
  const [question, setQuestion] = useState("");
  const [scope, setScope] = useState<ChatScope>({
    sourceId: "",
    language: "",
    days: 30,
  });
  const [selected, setSelected] = useState<Article | null>(null);
  const eligibleSources = sources.filter(
    (s) => s.category === "NEWS" || s.category === "INSTITUTION",
  );
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const mode =
      (event.nativeEvent as SubmitEvent).submitter?.getAttribute("value") ===
      "retrieve"
        ? "retrieve"
        : "answer";
    if (mode === "answer" && !status.data?.configured) return;
    if (!question.trim() || busy) return;
    if (await send(question.trim(), { ...scope }, mode)) setQuestion("");
  }
  return (
    <>
      <div className="section-heading">
        <div>
          <span className="eyebrow">PHÒNG ĐỌC THÔNG MINH</span>
          <h1>Đọc sâu hơn cùng AI.</h1>
          <p>
            Đặt câu hỏi, đối chiếu dẫn chứng và mở bài gốc ngay trong cuộc trò
            chuyện.
          </p>
        </div>
        <span
          className={`badge ${status.data?.configured ? "success" : "pending"}`}
        >
          {status.data?.configured ? "Đã cấu hình AI" : "Chưa cấu hình AI"}
        </span>
      </div>
      {status.error && (
        <div className="error-box" role="alert">
          {status.error}
        </div>
      )}
      <div className="chat-layout">
        <section className="chat-workspace" aria-label="Hội thoại AI">
          <div className="chat-toolbar">
            <span>
              <MessageSquare size={18} /> Trợ lý đọc tin
            </span>
            <button
              className="text-button"
              disabled={busy || !turns.length}
              onClick={clear}
            >
              <Trash2 size={14} /> Cuộc trò chuyện mới
            </button>
          </div>
          {!status.loading && status.data && !status.data.configured && (
            <div className="chat-setup" role="status">
              <strong>Chưa có kết nối OpenRouter</strong>
              <p>
                Để lập chỉ mục vector, tìm kiếm ngữ nghĩa và hỏi AI, cấu hình
                API key trên máy chủ rồi chờ hệ thống lập chỉ mục.
              </p>
              <details>
                <summary>Hướng dẫn kích hoạt</summary>
                <p>
                  Điền <code>OPENROUTER_API_KEY</code> trong file{" "}
                  <code>.env</code> bên ngoài project (thư mục{" "}
                  <code>OpenRouter key</code>), đặt đường dẫn qua{" "}
                  <code>OPENROUTER_ENV_FILE</code> trong cấu hình project, sau
                  đó chạy <code>docker compose up -d backend</code>. Khóa
                  OpenRouter không nhập vào trình duyệt và không dùng chung với
                  khóa quản trị.
                </p>
              </details>
            </div>
          )}
          <div
            ref={transcript}
            className="chat-transcript"
            aria-live="polite"
            aria-busy={busy}
          >
            {!turns.length && (
              <div className="chat-welcome">
                <span className="chat-welcome-icon">
                  <BookOpen size={29} />
                </span>
                <h2>Bắt đầu từ một câu hỏi.</h2>
                <p>
                  Tôi đọc các tiêu đề và tóm tắt trong kho tin của bạn. Mỗi ý
                  trả lời phải có dẫn chứng; khi thiếu thông tin, tôi sẽ nói rõ.
                </p>
                <div className="chat-prompts">
                  {prompts.map((prompt) => (
                    <button key={prompt} onClick={() => setQuestion(prompt)}>
                      {prompt}
                      <ArrowUpRight size={15} />
                    </button>
                  ))}
                </div>
              </div>
            )}
            {turns.map((turn) => (
              <ChatTurnView
                key={turn.id}
                turn={turn}
                openSource={setSelected}
              />
            ))}
            {busy && (
              <div className="chat-pending" role="status">
                <span className="status-dot" /> Đang tìm ngữ cảnh và xử lý câu
                hỏi…
              </div>
            )}
          </div>
          <form className="chat-composer" onSubmit={submit}>
            <label className="sr-only" htmlFor="chat-question">
              Câu hỏi về kho tin
            </label>
            <textarea
              id="chat-question"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              maxLength={1500}
              rows={3}
              required
              placeholder="Hỏi về giá vàng, lãi suất, doanh nghiệp…"
              disabled={busy}
            />
            <div className="chat-composer-actions">
              <span>{question.length}/1500</span>
              <div>
                <button
                  type="submit"
                  value="retrieve"
                  className="button secondary compact"
                  disabled={
                    busy ||
                    !question.trim() ||
                    !status.data?.configured ||
                    !status.data.index.ready
                  }
                >
                  <Search size={15} />
                  Tìm theo ngữ nghĩa
                </button>
                <button
                  type="submit"
                  value="answer"
                  className="button primary compact"
                  disabled={
                    busy ||
                    !question.trim() ||
                    !status.data?.configured ||
                    !status.data.index.ready
                  }
                >
                  <Send size={15} />
                  Hỏi AI
                </button>
              </div>
            </div>
          </form>
        </section>
        <aside className="chat-context">
          <div className="chat-context-heading">
            <ShieldCheck size={19} />
            <h2>Kho tri thức của bạn</h2>
          </div>
          <strong className="chat-knowledge-count">
            {status.data?.knowledge.articles.toLocaleString("vi-VN") ?? "—"}
            <span>bài từ {status.data?.knowledge.sources ?? "—"} nguồn</span>
          </strong>
          <p>
            Chỉ báo chí và tổ chức kinh tế. Bài diễn đàn, mạng xã hội được loại
            khỏi ngữ cảnh AI.
          </p>
          <div className="chat-context-note" role="status">
            <strong>Chỉ mục ngữ nghĩa</strong>
            <p>
              {status.data?.index.ready ?? 0} bài sẵn sàng ·{" "}
              {status.data?.index.chunks ?? 0} đoạn
            </p>
            <p>
              {status.data?.index.pending ?? 0} bài đang chờ ·{" "}
              {status.data?.index.failed ?? 0} bài lỗi, sẽ thử lại
            </p>
          </div>
          <div className="chat-scope">
            <h3>Phạm vi câu hỏi tiếp theo</h3>
            <label>
              Nguồn
              <select
                value={scope.sourceId}
                onChange={(e) =>
                  setScope({ ...scope, sourceId: e.target.value })
                }
                disabled={busy}
              >
                <option value="">Tất cả nguồn báo / tổ chức</option>
                {eligibleSources.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Ngôn ngữ bài viết
              <select
                value={scope.language}
                onChange={(e) =>
                  setScope({ ...scope, language: e.target.value })
                }
                disabled={busy}
              >
                <option value="">Tiếng Việt và quốc tế</option>
                <option value="vi">Tiếng Việt</option>
                <option value="en">Tiếng Anh</option>
              </select>
            </label>
            <label>
              Khoảng thời gian
              <select
                value={scope.days}
                onChange={(e) =>
                  setScope({ ...scope, days: Number(e.target.value) })
                }
                disabled={busy}
              >
                <option value={1}>24 giờ gần nhất</option>
                <option value={7}>7 ngày gần nhất</option>
                <option value={30}>30 ngày gần nhất</option>
                <option value={3650}>Toàn bộ kho tin (tối đa 10 năm)</option>
              </select>
            </label>
          </div>
          <div className="chat-context-note">
            <strong>Phạm vi dữ liệu</strong>
            <p>
              Tiêu đề và tóm tắt, chưa có toàn văn. Nếu thiếu ngày xuất bản, bộ
              lọc dùng thời điểm thu thập.
            </p>
            <span>
              Thu thập gần nhất
              <br />
              {dateTime(status.data?.knowledge.lastCollectedAt ?? null)}
            </span>
          </div>
          <p className="chat-privacy">
            Khi hỏi AI, câu hỏi, tối đa 3 câu hỏi trước và tối đa 8 đoạn tin
            liên quan được gửi đến OpenRouter. Nội dung báo cũng được gửi khi
            tạo embedding. Lịch sử chỉ giữ trong bộ nhớ tab, không lưu vào cơ sở
            dữ liệu.
          </p>
        </aside>
      </div>
      {selected && (
        <Modal title="Dẫn chứng từ kho tin" close={() => setSelected(null)}>
          <div className="article-detail">
            <span className="eyebrow">{selected.sourceName}</span>
            <h2>{selected.title}</h2>
            <p>{selected.summary || "Nguồn chưa cung cấp tóm tắt."}</p>
            <dl>
              <dt>Xuất bản</dt>
              <dd>{dateTime(selected.publishedAt)}</dd>
              <dt>Thu thập</dt>
              <dd>{dateTime(selected.collectedAt)}</dd>
            </dl>
            <a
              className="button primary"
              href={selected.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              Mở bài gốc
              <ArrowUpRight size={16} />
            </a>
          </div>
        </Modal>
      )}
    </>
  );
}
function ChatTurnView({
  turn,
  openSource,
}: {
  turn: ChatTurn;
  openSource: (article: Article) => void;
}) {
  const evidence = turn.answer?.sources ?? turn.retrieval ?? [];
  const citeNumber = (id: string) => evidence.findIndex((s) => s.id === id) + 1;
  return (
    <article className="chat-turn">
      <div className="chat-user-question">
        <span>BẠN</span>
        <p>{turn.question}</p>
        <small>
          {turn.scope.language
            ? turn.scope.language.toUpperCase()
            : "Mọi ngôn ngữ"}{" "}
          · {turn.scope.days} ngày{turn.scope.sourceId ? " · Đã lọc nguồn" : ""}
        </small>
      </div>
      {turn.error && (
        <div role="alert" className="error-box">
          {turn.error}
        </div>
      )}
      {(turn.answer || turn.retrieval) && (
        <div className="chat-response">
          <div className="chat-response-label">
            <BookOpen size={16} />
            {turn.answer ? "FINANCE RADAR AI" : "KẾT QUẢ TỪ KHO TIN"}
          </div>
          {turn.answer?.statements.map((statement, i) => (
            <div className="chat-statement" key={i}>
              <p>
                {statement.text}
                {statement.evidence.map((citation, j) => (
                  <button
                    className="citation-chip"
                    key={`${citation.articleId}-${j}`}
                    title={citation.quote}
                    aria-label={`Xem nguồn ${citeNumber(citation.articleId)}`}
                    onClick={() => {
                      const source = evidence.find(
                        (s) => s.id === citation.articleId,
                      );
                      if (source) openSource(source);
                    }}
                  >
                    [{citeNumber(citation.articleId)}]
                  </button>
                ))}
              </p>
              <details className="chat-quotes">
                <summary>Đối chiếu đoạn trích</summary>
                {statement.evidence.map((citation, j) => (
                  <blockquote key={j}>
                    “{citation.quote}”{" "}
                    <span>— Nguồn [{citeNumber(citation.articleId)}]</span>
                  </blockquote>
                ))}
              </details>
            </div>
          ))}
          <p className="chat-answer-note">
            {turn.answer?.message ??
              (evidence.length
                ? `Tìm thấy ${evidence.length} bài liên quan. Đây là kết quả truy xuất dữ liệu, chưa phải câu trả lời do AI tạo.`
                : "Chưa tìm thấy bài phù hợp. Thử đổi chủ đề hoặc phạm vi tìm kiếm.")}
          </p>
          {!!evidence.length && (
            <details
              className="chat-source-list"
              open={
                turn.retrieval !== undefined ||
                turn.answer?.status !== "ANSWERED"
              }
            >
              <summary>
                <ChevronDown size={14} />
                {evidence.length} bài nguồn
              </summary>
              {evidence.map((article, i) => (
                <button
                  className="chat-source"
                  key={article.id}
                  onClick={() => openSource(article)}
                >
                  <span className="chat-source-index">{i + 1}</span>
                  <span>
                    <strong>{article.title}</strong>
                    <small>
                      {article.sourceName} ·{" "}
                      {article.publishedAt ? "Đăng" : "Thu thập"}{" "}
                      {dateTime(article.publishedAt || article.collectedAt)}
                    </small>
                  </span>
                  <ArrowUpRight size={16} />
                </button>
              ))}
            </details>
          )}
        </div>
      )}
    </article>
  );
}
