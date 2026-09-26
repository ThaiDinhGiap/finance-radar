import { useResource } from "../../shared/useResource";
import { dateTime } from "../../shared/types";
interface Entry {
  id: string;
  targetStoryId: string;
  articleIds: string[];
  previousStoryIds: string[];
  reason: string;
  createdAt: string;
}
export function CurationHistory({ revision }: { revision: number }) {
  const history = useResource<Entry[]>(
    "/stories/curation-history",
    revision,
    30000,
  );
  return (
    <section className="digest-group">
      <h2>Lịch sử chỉnh Story</h2>
      <p className="hint">
        100 thao tác gần nhất. Mở Story trên dòng tin → Chỉnh Story để gộp hoặc
        tách bài. Workspace hiện chưa định danh operator.
      </p>
      {history.error && <p role="alert">{history.error}</p>}
      {history.data?.map((e) => (
        <article className="story-member" key={e.id}>
          <p>{e.reason}</p>
          <small>
            {dateTime(e.createdAt)} · {e.articleIds.length} bài
          </small>
          <details>
            <summary>Chi tiết chuyển nhóm</summary>
            <p>Story đích: {e.targetStoryId}</p>
            {e.articleIds.map((id, i) => (
              <p key={id}>
                {id} ← {e.previousStoryIds[i]}
              </p>
            ))}
          </details>
        </article>
      ))}
      {history.data?.length === 0 && <p>Chưa có thao tác chỉnh Story.</p>}
    </section>
  );
}
