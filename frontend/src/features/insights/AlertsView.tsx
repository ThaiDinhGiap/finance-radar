import { useState, type FormEvent } from "react";
import { dateTime } from "../../shared/types";
import type { Watchlist } from "../discovery/types";
import type { AlertRule, AlertsModel } from "./useAlerts";
function RuleForm({
  watch,
  rule,
  save,
}: {
  watch: Watchlist;
  rule?: AlertRule;
  save: (id: string, rule: AlertRule) => void;
}) {
  const [enabled, setEnabled] = useState(rule?.enabled ?? false);
  const [minimum, setMinimum] = useState(rule?.minimum ?? 1);
  const [keyword, setKeyword] = useState(rule?.keyword ?? "");
  const [saved, setSaved] = useState(false);
  function submit(e: FormEvent) {
    e.preventDefault();
    save(watch.id, { enabled, minimum, keyword });
    setSaved(true);
  }
  return (
    <form className="alert-rule" onSubmit={submit}>
      <h2>{watch.name}</h2>
      <label>
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => {
            setEnabled(e.target.checked);
            setSaved(false);
          }}
        />{" "}
        Bật cảnh báo {watch.name}
      </label>
      <div className="discovery-filters">
        <label>
          Số tin mới tối thiểu
          <input
            aria-label={`Ngưỡng ${watch.name}`}
            type="number"
            min={1}
            max={1000}
            required
            value={minimum}
            onChange={(e) => {
              setMinimum(Number(e.target.value));
              setSaved(false);
            }}
          />
        </label>
        <label>
          Điều kiện từ khóa bổ sung
          <input
            aria-label={`Điều kiện ${watch.name}`}
            maxLength={200}
            value={keyword}
            onChange={(e) => {
              setKeyword(e.target.value);
              setSaved(false);
            }}
            placeholder="Để trống: mọi tin khớp Watchlist"
          />
        </label>
      </div>
      <button className="button secondary" type="submit">
        Lưu cảnh báo {watch.name}
      </button>
      {saved && <span role="status"> Đã gửi cấu hình cảnh báo.</span>}
      <p className="hint">
        Lưu lại sẽ bắt đầu mốc theo dõi mới. Ngưỡng tính số bài mới tích lũy từ
        mốc đó hoặc cảnh báo trước, không phải số Story.
      </p>
    </form>
  );
}
export function AlertsView({
  watches,
  alerts,
}: {
  watches: Watchlist[];
  alerts: AlertsModel;
}) {
  return (
    <>
      <div className="section-heading">
        <div>
          <span className="eyebrow">THEO DÕI CÁ NHÂN</span>
          <h1>Thông báo & Alert</h1>
          <p>
            Kiểm tra Watchlist mỗi 60 giây khi ứng dụng đang mở. Lưu riêng trên
            trình duyệt này.
          </p>
        </div>
      </div>
      <p className="hint">
        Khi mở lại ứng dụng, tin phát sinh từ mốc đã lưu sẽ được kiểm tra. Không
        gửi email/push khi ứng dụng đóng. Tối đa 20 rule bật và 100 cảnh báo gần
        nhất.
      </p>
      <div className="discovery-actions">
        <button
          className="button secondary"
          disabled={alerts.checking}
          onClick={alerts.refresh}
        >
          {alerts.checking ? "Đang kiểm tra…" : "Kiểm tra ngay"}
        </button>
        <button
          className="button secondary"
          disabled={alerts.desktop}
          onClick={() => void alerts.enableDesktop()}
        >
          {alerts.desktop
            ? "Đã bật thông báo trình duyệt"
            : "Bật thông báo trình duyệt"}
        </button>
        <button className="link-button" onClick={() => alerts.markRead()}>
          Đánh dấu tất cả đã đọc
        </button>
      </div>
      {alerts.error && (
        <p className="error-box" role="alert">
          {alerts.error}
        </p>
      )}
      {!watches.length && (
        <div className="empty-state">
          <h2>Chưa có Watchlist</h2>
          <a href="#articles">Tạo Watchlist tại Dòng thông tin</a>
        </div>
      )}
      <details open={!alerts.notices.length}>
        <summary>Thiết lập cảnh báo ({watches.length} Watchlist)</summary>
        {watches.map((w) => (
          <RuleForm
            key={`${w.id}:${alerts.rules[w.id]?.enabled}:${alerts.rules[w.id]?.minimum}:${alerts.rules[w.id]?.keyword}`}
            watch={w}
            rule={alerts.rules[w.id]}
            save={alerts.configure}
          />
        ))}
      </details>
      <section aria-label="Danh sách cảnh báo" className="digest-group">
        <h2>Cảnh báo gần đây</h2>
        {!alerts.notices.length && (
          <p>
            Chưa có cảnh báo mới. Sau khi bật rule, hệ thống bắt đầu theo dõi từ
            thời điểm thiết lập.
          </p>
        )}
        {alerts.notices.map((n) => (
          <article className="story-member" key={n.id}>
            <h3>
              {!n.read && <span className="badge pending">Chưa đọc</span>}{" "}
              {n.watchName} · {n.count} tin mới
            </h3>
            <p className="hint">
              {dateTime(n.at)} · Hiển thị tối đa 5 bài nguồn
            </p>
            <ul className="citation-list">
              {n.articles.map((a) => (
                <li key={a.id}>
                  <a href={a.url} target="_blank" rel="noopener noreferrer">
                    {a.sourceName} — {a.title}
                  </a>
                </li>
              ))}
            </ul>
            {!n.read && (
              <button
                className="link-button"
                onClick={() => alerts.markRead(n.id)}
              >
                Đánh dấu đã đọc {n.watchName}
              </button>
            )}
          </article>
        ))}
      </section>
    </>
  );
}
