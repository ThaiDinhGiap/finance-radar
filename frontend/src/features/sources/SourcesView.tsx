import { useState } from "react";
import { Plus, Play, Pause, Pencil, ArrowUpRight, Radio } from "lucide-react";
import { categories, dateTime, type Source } from "../../shared/types";
import { request } from "../../shared/api";
import { SourceForm } from "./SourceForm";
export function SourcesView({
  sources,
  refresh,
}: {
  sources: Source[];
  refresh: () => void;
}) {
  const [form, setForm] = useState<Source | "new" | null>(null);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  async function action(source: Source, crawl: boolean) {
    setBusy(source.id);
    setError("");
    setMessage("");
    try {
      await request(`/sources/${source.id}${crawl ? "/crawl" : ""}`, {
        method: crawl ? "POST" : "PATCH",
        ...(crawl
          ? {}
          : { body: JSON.stringify({ enabled: !source.enabled }) }),
      });
      setMessage(
        crawl
          ? `Đã đưa ${source.name} vào hàng đợi. Xem tiến độ tại Nhật ký thu thập.`
          : "Đã cập nhật trạng thái nguồn.",
      );
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể thực hiện");
    } finally {
      setBusy("");
    }
  }
  function showForm(source: Source | "new") {
    setForm(source);
  }
  return (
    <>
      <div className="section-heading">
        <div>
          <span className="eyebrow">MẠNG LƯỚI THÔNG TIN</span>
          <h1>Nguồn dữ liệu</h1>
          <p>Chọn nguồn, đặt lịch và kiểm soát quá trình thu thập.</p>
        </div>
        <button className="button primary" onClick={() => showForm("new")}>
          <Plus size={18} />
          Thêm nguồn
        </button>
      </div>
      <div className="info-strip">
        <Radio size={19} />
        <p>
          RSS, Atom, HTML và Mastodon công khai. Mỗi nguồn có lịch riêng; trạng
          thái phản ánh kết quả thu thập thực tế.
        </p>
      </div>
      {message && (
        <div className="success-box" role="status">
          {message}
        </div>
      )}
      {error && (
        <div className="error-box" role="alert">
          {error}
        </div>
      )}
      {!sources.length && (
        <div className="empty-state">
          <Radio size={30} />
          <h3>Bắt đầu từ một nguồn tin.</h3>
          <p>
            Thêm nguồn báo hoặc tổ chức bạn muốn theo dõi để xây dựng dòng tin
            của mình.
          </p>
        </div>
      )}
      <div className="source-grid">
        {sources.map((s) => (
          <article className="source-card" key={s.id}>
            <div className="source-card-top">
              <span className="source-monogram">
                {s.name.substring(0, 2).toUpperCase()}
              </span>
              <span
                className={`badge ${s.activeRunId ? "pending" : !s.enabled ? "muted" : s.failures ? "danger" : "success"}`}
              >
                {s.activeRunId
                  ? "Đang xử lý"
                  : !s.enabled
                    ? "Tạm dừng"
                    : s.failures
                      ? "Cần kiểm tra"
                      : "Đã bật"}
              </span>
            </div>
            <h2>{s.name}</h2>
            <div className="source-card-meta">
              {categories[s.category]} <span>·</span> {s.language.toUpperCase()}{" "}
              <span>·</span> {s.kind}
            </div>
            <a
              className="source-url"
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              {new URL(s.url).hostname}
              <ArrowUpRight size={14} />
            </a>
            <dl>
              <dt>Chu kỳ</dt>
              <dd>{s.intervalMinutes} phút</dd>
              <dt>Thành công gần nhất</dt>
              <dd>{dateTime(s.lastSuccessAt)}</dd>
            </dl>
            <div className="source-actions">
              <button
                className="button secondary compact"
                disabled={!s.enabled || !!s.activeRunId || busy === s.id}
                onClick={() => void action(s, true)}
              >
                <Play size={14} />
                Thu thập
              </button>
              <button
                className="icon-button"
                aria-label={`${s.enabled ? "Tạm dừng" : "Bật"} ${s.name}`}
                disabled={busy === s.id}
                onClick={() => void action(s, false)}
              >
                {s.enabled ? <Pause size={17} /> : <Play size={17} />}
              </button>
              <button
                className="icon-button"
                aria-label={`Sửa ${s.name}`}
                disabled={!!s.activeRunId}
                onClick={() => showForm(s)}
              >
                <Pencil size={16} />
              </button>
            </div>
          </article>
        ))}
      </div>
      {form && (
        <SourceForm
          source={form === "new" ? undefined : form}
          close={() => setForm(null)}
          saved={() => {
            setForm(null);
            refresh();
            setMessage("Đã lưu cấu hình nguồn.");
          }}
        />
      )}
    </>
  );
}
