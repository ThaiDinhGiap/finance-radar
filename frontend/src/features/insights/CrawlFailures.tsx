import { useState } from "react";
import { useResource } from "../../shared/useResource";
import { Pagination } from "../../shared/Pagination";
import { dateTime, type Page } from "../../shared/types";
interface Failure {
  id: string;
  sourceName: string;
  errorType: string;
  message: string | null;
  finishedAt: string | null;
}
export function CrawlFailures({ revision }: { revision: number }) {
  const [type, setType] = useState("PARSE");
  const [page, setPage] = useState(0);
  const { data, error, loading } = useResource<Page<Failure>>(
    `/operations/failures?type=${type}&page=${page}&size=20`,
    revision,
    15000,
  );
  return (
    <section className="digest-group">
      <h2>Lỗi crawl / parse</h2>
      <label>
        Loại lỗi
        <select
          aria-label="Loại lỗi crawl"
          value={type}
          onChange={(e) => {
            setType(e.target.value);
            setPage(0);
          }}
        >
          <option value="PARSE">Lỗi parse</option>
          <option value="TIMEOUT">Job hết hạn</option>
          <option value="UNKNOWN">Chưa phân loại</option>
          <option value="ALL">Tất cả lỗi</option>
        </select>
      </label>
      {error && (
        <p className="error-box" role="alert">
          {error}
        </p>
      )}
      {loading ? (
        <p role="status">Đang tải lỗi…</p>
      ) : (
        !error && (
          <>
            <p>{data?.total ?? 0} lượt thất bại · Toàn bộ lịch sử</p>
            <div
              className="table-wrap"
              role="region"
              aria-label="Chi tiết lỗi crawl"
              tabIndex={0}
            >
              <table>
                <thead>
                  <tr>
                    <th scope="col">Nguồn</th>
                    <th scope="col">Loại</th>
                    <th scope="col">Thời điểm</th>
                    <th scope="col">Thông tin</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.items.map((r) => (
                    <tr key={r.id}>
                      <td>{r.sourceName}</td>
                      <td>{r.errorType}</td>
                      <td>{dateTime(r.finishedAt)}</td>
                      <td>{r.message ?? "Không có chi tiết"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {data && (
              <Pagination
                page={page}
                size={20}
                total={data.total}
                change={setPage}
              />
            )}
          </>
        )
      )}
    </section>
  );
}
