import { useState, type FormEvent } from "react";
import { Modal } from "../../shared/Modal";
import {
  categories,
  type Kind,
  type Category,
  type Source,
} from "../../shared/types";
import { request } from "../../shared/api";
export function SourceForm({
  close,
  saved,
  source,
}: {
  close: () => void;
  saved: () => void;
  source?: Source;
}) {
  const [kind, setKind] = useState<Kind>(source?.kind ?? "RSS");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const fields = new FormData(event.currentTarget);
    const body = {
      name: fields.get("name"),
      url: fields.get("url"),
      kind,
      category: fields.get("category") as Category,
      language: fields.get("language"),
      region: fields.get("region"),
      intervalMinutes: Number(fields.get("intervalMinutes")),
      itemSelector: fields.get("itemSelector"),
      titleSelector: fields.get("titleSelector"),
      linkSelector: fields.get("linkSelector"),
      summarySelector: fields.get("summarySelector"),
    };
    try {
      await request(source ? `/sources/${source.id}` : "/sources", {
        method: source ? "PUT" : "POST",
        body: JSON.stringify(body),
      });
      saved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể lưu nguồn");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={source ? "Chỉnh sửa nguồn dữ liệu" : "Thêm nguồn dữ liệu"}
      close={close}
    >
      <form className="source-form" onSubmit={submit}>
        <p className="hint">
          {source
            ? "Cập nhật cấu hình và lịch thu thập của nguồn."
            : "Nguồn mới được lưu ở trạng thái tạm dừng. Kiểm tra cấu hình trước khi bật thu thập."}
        </p>
        <label>
          Tên nguồn
          <input
            name="name"
            required
            maxLength={120}
            defaultValue={source?.name}
            placeholder="Ví dụ: Báo kinh tế · Thị trường"
          />
        </label>
        <label>
          URL nguồn
          <input
            name="url"
            type="url"
            required
            maxLength={2048}
            defaultValue={source?.url}
            placeholder="https://example.com/rss/finance.xml"
          />
        </label>
        <div className="form-grid">
          <label>
            Phương thức
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as Kind)}
            >
              <option value="RSS">RSS / Atom</option>
              <option value="HTML">Trang HTML</option>
              <option value="MASTODON">Mastodon API công khai</option>
            </select>
          </label>
          <label>
            Loại nguồn
            <select name="category" defaultValue={source?.category ?? "NEWS"}>
              {Object.entries(categories).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Ngôn ngữ
            <select name="language" defaultValue={source?.language ?? "vi"}>
              <option value="vi">Tiếng Việt</option>
              <option value="en">Tiếng Anh</option>
              <option value="other">Khác</option>
            </select>
          </label>
          <label>
            Khu vực
            <select name="region" defaultValue={source?.region ?? "VN"}>
              <option value="VN">Việt Nam</option>
              <option value="GLOBAL">Toàn cầu</option>
              <option value="US">Hoa Kỳ</option>
              <option value="EU">Châu Âu</option>
            </select>
          </label>
        </div>
        <label>
          Chu kỳ thu thập (phút)
          <input
            name="intervalMinutes"
            type="number"
            required
            min={15}
            max={10080}
            defaultValue={source?.intervalMinutes ?? 30}
          />
        </label>
        {kind === "HTML" && (
          <fieldset>
            <legend>Bộ chọn CSS cho trang danh sách</legend>
            <p className="hint">
              Các bộ chọn tiêu đề, liên kết và tóm tắt được tìm bên trong mỗi
              mục.
            </p>
            <label>
              Mục bài viết
              <input
                name="itemSelector"
                required
                maxLength={300}
                defaultValue={source?.itemSelector ?? ""}
                placeholder="article"
              />
            </label>
            <label>
              Tiêu đề
              <input
                name="titleSelector"
                required
                maxLength={300}
                defaultValue={source?.titleSelector ?? ""}
                placeholder="h2"
              />
            </label>
            <label>
              Liên kết
              <input
                name="linkSelector"
                required
                maxLength={300}
                defaultValue={source?.linkSelector ?? ""}
                placeholder="a"
              />
            </label>
            <label>
              Tóm tắt (không bắt buộc)
              <input
                name="summarySelector"
                maxLength={300}
                defaultValue={source?.summarySelector ?? ""}
                placeholder=".description"
              />
            </label>
          </fieldset>
        )}
        {kind === "MASTODON" && (
          <p className="hint">
            Dùng endpoint hashtag công khai, ví dụ
            /api/v1/timelines/tag/economics?limit=20. Instance có thể yêu cầu
            xác thực hoặc chặn robots.
          </p>
        )}
        {error && (
          <div className="error-box" role="alert">
            {error}
          </div>
        )}
        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={close}>
            Hủy
          </button>
          <button className="button primary" disabled={busy}>
            {busy ? "Đang lưu…" : "Lưu nguồn"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
