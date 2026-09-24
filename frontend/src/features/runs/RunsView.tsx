import { useState } from "react";
import { useResource } from "../../shared/useResource";
import { dateTime, type CrawlRun, type Page } from "../../shared/types";
import { Pagination } from "../../shared/Pagination";
const states: Record<string, string> = {
  QUEUED: "Đang chờ",
  RUNNING: "Đang chạy",
  SUCCESS: "Thành công",
  FAILED: "Thất bại",
};
export function RunsView({ revision }: { revision: number }) {
  const [page, setPage] = useState(0);
  const { data, error, loading } = useResource<Page<CrawlRun>>(
    `/runs?page=${page}&size=20`,
    revision,
    5000,
  );
  return (
    <>
      <div className="section-heading">
        <div>
          <span className="eyebrow">VẬN HÀNH</span>
          <h1>Nhật ký thu thập</h1>
          <p>Theo dõi từng lượt chạy, bài mới và nguyên nhân lỗi.</p>
        </div>
        <span className="edition">CẬP NHẬT MỖI 5 GIÂY</span>
      </div>
      {error && (
        <div className="error-box" role="alert">
          {error}
        </div>
      )}
      {loading ? (
        <div className="empty-state" role="status">
          Đang tải nhật ký…
        </div>
      ) : !data?.items.length ? (
        <div className="empty-state">
          <h3>Chưa có lượt thu thập</h3>
          <p>Bật một nguồn và chọn Thu thập để bắt đầu.</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <caption>Lịch sử các lượt thu thập · Mới nhất trước</caption>
            <thead>
              <tr>
                <th scope="col">Nguồn / Thời gian</th>
                <th scope="col">Trạng thái</th>
                <th scope="col">Đã đọc</th>
                <th scope="col">Bài mới</th>
                <th scope="col">Loại bỏ</th>
                <th scope="col">Kết quả</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((run) => (
                <tr key={run.id}>
                  <td>
                    <strong>{run.sourceName}</strong>
                    <small>{dateTime(run.createdAt)}</small>
                  </td>
                  <td>
                    <span
                      className={`badge ${run.status === "SUCCESS" ? "success" : run.status === "FAILED" ? "danger" : "pending"}`}
                    >
                      {states[run.status]}
                    </span>
                  </td>
                  <td>{run.fetched}</td>
                  <td className="inserted-count">+{run.inserted}</td>
                  <td>{run.rejected}</td>
                  <td className="run-message">
                    {run.message ||
                      (run.status === "SUCCESS"
                        ? `${run.fetched - run.inserted - run.rejected} bài trùng đã bỏ qua`
                        : "Đang xử lý…")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data && (
        <Pagination page={page} size={20} total={data.total} change={setPage} />
      )}
    </>
  );
}
