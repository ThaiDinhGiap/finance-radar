import { useState, type FormEvent } from "react";
import { useResource } from "../../shared/useResource";
import { request } from "../../shared/api";
import { type Article, type Page } from "../../shared/types";
import type { Topic } from "./types";
const relations: Record<string, string> = {
  CEO: "Có CEO",
  SUBSIDIARY: "Có công ty con",
  RELATED_COMPANY: "Liên quan công ty",
};
interface Relationship {
  id: string;
  fromId: string;
  fromName: string;
  toId: string;
  toName: string;
  relation: string;
  evidence: string;
  article: Article;
  createdAt: string;
}
export function EntityGraphView({ revision }: { revision: number }) {
  const [retry, setRetry] = useState(0);
  const [entity, setEntity] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [relation, setRelation] = useState("CEO");
  const [query, setQuery] = useState("");
  const [article, setArticle] = useState<Article | null>(null);
  const [evidence, setEvidence] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [newId, setNewId] = useState("");
  const [newName, setNewName] = useState("");
  const topics = useResource<Topic[]>("/topics", revision + retry);
  const entities = topics.data?.filter((t) => t.kind === "ENTITY") ?? [];
  const graph = useResource<Relationship[]>(
    `/entities/relationships?entityId=${entity}`,
    revision + retry,
  );
  const articles = useResource<Page<Article>>(
    `/articles?q=${encodeURIComponent(query)}&size=10`,
    revision,
  );
  async function mutate(path: string, body: unknown, method = "POST") {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await request(path, {
        method,
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      setRetry((v) => v + 1);
      setMessage("Đã lưu thay đổi.");
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không lưu được.");
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (
      await mutate("/entities/relationships", {
        fromId: from,
        toId: to,
        relation,
        articleId: article?.id,
        evidence,
      })
    ) {
      setEvidence("");
      setArticle(null);
    }
  }
  return (
    <>
      <div className="section-heading">
        <div>
          <span className="eyebrow">QUAN HỆ CÓ DẪN CHỨNG</span>
          <h1>Entity Graph</h1>
          <p>
            Quan hệ do operator nhập, gắn trích dẫn và bài gốc để người đọc kiểm
            chứng.
          </p>
        </div>
      </div>
      <label>
        Lọc entity
        <select value={entity} onChange={(e) => setEntity(e.target.value)}>
          <option value="">Tất cả entity</option>
          {entities.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </label>
      <p className="hint">
        Tối đa 200 quan hệ gần nhất. Mũi tên đi từ công ty/tổ chức đến CEO, công
        ty con hoặc công ty liên quan. Không suy ra quan hệ chỉ từ việc xuất
        hiện cùng bài; trích dẫn chứng minh phải được tự đối chiếu về ngữ nghĩa
        và thời điểm.
      </p>
      {(error || topics.error || graph.error) && (
        <p className="error-box" role="alert">
          {error || topics.error || graph.error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
      {graph.loading ? (
        <p>Đang tải quan hệ…</p>
      ) : (
        !graph.error &&
        !graph.data?.length && (
          <p>Chưa có quan hệ được nhập trong phạm vi này.</p>
        )
      )}
      {graph.data?.map((r) => (
        <article className="digest-group" key={r.id}>
          <div className="entity-edge">
            <button
              className="button secondary"
              onClick={() => setEntity(r.fromId)}
            >
              {r.fromName}
            </button>
            <span>→ {relations[r.relation]} →</span>
            <button
              className="button secondary"
              onClick={() => setEntity(r.toId)}
            >
              {r.toName}
            </button>
          </div>
          <blockquote>{r.evidence}</blockquote>
          <a href={r.article.url} target="_blank" rel="noopener noreferrer">
            {r.article.title} · {r.article.sourceName}
          </a>
          <details>
            <summary>Sửa dữ liệu quan hệ</summary>
            <p>Xóa quan hệ sai rồi nhập lại cùng chứng cứ phù hợp.</p>
            <button
              className="button secondary"
              disabled={busy}
              onClick={() =>
                void mutate(`/entities/relationships/${r.id}`, null, "DELETE")
              }
            >
              Xóa quan hệ {r.fromName} → {r.toName}
            </button>
          </details>
        </article>
      ))}
      <details className="digest-group">
        <summary>Thêm entity vào danh mục</summary>
        <form
          className="discovery-form"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await mutate("/entities", { id: newId, name: newName })) {
              setNewId("");
              setNewName("");
            }
          }}
        >
          <label>
            Mã entity
            <input
              required
              pattern="[a-z0-9-]{1,60}"
              maxLength={60}
              value={newId}
              onChange={(e) => setNewId(e.target.value)}
              placeholder="nguyen-van-a"
            />
          </label>
          <label>
            Tên entity
            <input
              required
              maxLength={120}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
          </label>
          <p className="hint">
            Entity mới dùng cho graph; chưa có alias tự nhận diện trong bài
            viết.
          </p>
          <button className="button secondary" disabled={busy}>
            Thêm entity
          </button>
        </form>
      </details>
      <details className="digest-group">
        <summary>Thêm quan hệ có dẫn chứng</summary>
        <form className="discovery-form" onSubmit={submit}>
          <label>
            Entity nguồn
            <select
              aria-label="Entity nguồn"
              required
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            >
              <option value="">Chọn entity</option>
              {entities.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Loại quan hệ
            <select
              value={relation}
              onChange={(e) => setRelation(e.target.value)}
            >
              {Object.entries(relations).map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Entity đích
            <select
              aria-label="Entity đích"
              required
              value={to}
              onChange={(e) => setTo(e.target.value)}
            >
              <option value="">Chọn entity</option>
              {entities
                .filter((t) => t.id !== from)
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Tìm bài chứng minh
            <input
              maxLength={200}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setArticle(null);
              }}
            />
          </label>
          {articles.error && <p role="alert">{articles.error}</p>}
          <fieldset>
            <legend>Chọn bài gốc (10 kết quả đầu)</legend>
            {articles.data?.items.map((a) => (
              <label className="evidence-choice" key={a.id}>
                <input
                  type="radio"
                  name="evidenceArticle"
                  checked={article?.id === a.id}
                  onChange={() => {
                    setArticle(a);
                    setEvidence("");
                  }}
                />
                {a.title} · {a.sourceName}
              </label>
            ))}
          </fieldset>
          {article && (
            <div className="story-member">
              <p>{article.title}</p>
              <p>{article.summary}</p>
              <a href={article.url} target="_blank" rel="noopener noreferrer">
                Đọc bài chứng minh
              </a>
            </div>
          )}
          <label>
            Trích dẫn nguyên văn
            <textarea
              required
              maxLength={2000}
              value={evidence}
              onChange={(e) => setEvidence(e.target.value)}
            />
          </label>
          <button
            className="button primary"
            disabled={busy || !article || !from || !to || from === to}
          >
            Lưu quan hệ
          </button>
        </form>
      </details>
    </>
  );
}
