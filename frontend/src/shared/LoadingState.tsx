import { Skeleton } from "../components/ui/skeleton";

export function LoadingState({ label }: { label: string }) {
  return (
    <div className="loading-list" role="status" aria-label={label}>
      <span className="sr-only">{label}</span>
      {[0, 1, 2].map((row) => (
        <div key={row} className="loading-row" aria-hidden="true">
          <Skeleton className="loading-meta" />
          <Skeleton className="loading-title" />
          <Skeleton className="loading-summary" />
        </div>
      ))}
    </div>
  );
}
