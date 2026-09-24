import { ChevronLeft, ChevronRight } from "lucide-react";
export function Pagination({
  page,
  size,
  total,
  change,
}: {
  page: number;
  size: number;
  total: number;
  change: (page: number) => void;
}) {
  if (!total) return null;
  return (
    <div className="pagination">
      <span>
        {page * size + 1}–{Math.min((page + 1) * size, total)} /{" "}
        {total.toLocaleString("vi-VN")}
      </span>
      <div>
        <button
          className="icon-button"
          disabled={page === 0}
          onClick={() => change(page - 1)}
          aria-label="Trang trước"
        >
          <ChevronLeft size={18} />
        </button>
        <button
          className="icon-button"
          disabled={(page + 1) * size >= total}
          onClick={() => change(page + 1)}
          aria-label="Trang sau"
        >
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
}
