package vn.financeradar.infrastructure.persistence;

import java.sql.*;
import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;
import vn.financeradar.application.port.VectorRepository;
import vn.financeradar.domain.*;

@Repository
public class JdbcVectorRepository implements VectorRepository {
  private final JdbcClient db;
  private static final String FINGERPRINT = "md5(a.title || chr(10) || a.summary)";
  private static final String FRESH =
      "d.fingerprint=" + FINGERPRINT + " AND d.model=:model AND d.version=:version";

  public JdbcVectorRepository(JdbcClient db) {
    this.db = db;
  }

  @Transactional
  public Optional<IndexDocument> claim(String model, int version) {
    UUID lease = UUID.randomUUID();
    var candidates =
        db.sql(
                """
   SELECT a.id,a.title,a.summary,md5(a.title || chr(10) || a.summary) AS fingerprint
   FROM articles a JOIN sources s ON s.id=a.source_id LEFT JOIN rag_documents d ON d.article_id=a.id
   WHERE s.category IN ('NEWS','INSTITUTION') AND
   (d.article_id IS NULL OR (d.retry_at<=now() AND (d.status<>'READY' OR NOT (
   """
                    + FRESH
                    + "))) ) ORDER BY a.collected_at,a.id LIMIT 1 FOR UPDATE OF a SKIP LOCKED")
            .param("model", model)
            .param("version", version)
            .query(
                (r, n) ->
                    new IndexDocument(
                        r.getObject("id", UUID.class),
                        r.getString("title"),
                        r.getString("summary"),
                        r.getString("fingerprint"),
                        lease))
            .list();
    if (candidates.isEmpty()) return Optional.empty();
    var doc = candidates.get(0);
    db.sql(
            """
   INSERT INTO rag_documents(article_id,fingerprint,model,version,status,lease,retry_at)
   VALUES(:id,:hash,:model,:version,'INDEXING',:lease,now()+interval '5 minutes')
   ON CONFLICT(article_id) DO UPDATE SET fingerprint=excluded.fingerprint,model=excluded.model,
   version=excluded.version,status='INDEXING',lease=excluded.lease,retry_at=excluded.retry_at,updated_at=now(),last_error=NULL
   """)
        .param("id", doc.articleId())
        .param("hash", doc.fingerprint())
        .param("model", model)
        .param("version", version)
        .param("lease", lease)
        .update();
    return Optional.of(doc);
  }

  @Transactional
  public boolean complete(
      IndexDocument doc, String model, int version, List<String> chunks, List<float[]> vectors) {
    if (chunks.isEmpty() || chunks.size() != vectors.size())
      throw new IllegalArgumentException("Invalid index batch");
    int owned =
        db.sql(
                """
   UPDATE rag_documents d SET status='READY',updated_at=now(),retry_at=now(),last_error=NULL
   FROM articles a JOIN sources s ON s.id=a.source_id
   WHERE d.article_id=a.id AND d.article_id=:id AND d.lease=:lease AND d.status='INDEXING'
   AND s.category IN ('NEWS','INSTITUTION') AND
   """
                    + FRESH)
            .param("id", doc.articleId())
            .param("lease", doc.lease())
            .param("model", model)
            .param("version", version)
            .update();
    if (owned == 0) return false;
    db.sql("DELETE FROM rag_chunks WHERE article_id=:id").param("id", doc.articleId()).update();
    for (int i = 0; i < chunks.size(); i++)
      db.sql(
              "INSERT INTO rag_chunks(id,article_id,position,content,embedding) VALUES(:id,:article,:position,:content,CAST(:vector AS vector))")
          .param("id", UUID.randomUUID())
          .param("article", doc.articleId())
          .param("position", i)
          .param("content", chunks.get(i))
          .param("vector", vector(vectors.get(i)))
          .update();
    return true;
  }

  public void fail(IndexDocument doc, String message) {
    db.sql(
            "UPDATE rag_documents SET status='FAILED',last_error=:error,updated_at=now(),retry_at=now()+interval '5 minutes' WHERE article_id=:id AND lease=:lease AND status='INDEXING'")
        .param("id", doc.articleId())
        .param("lease", doc.lease())
        .param("error", message)
        .update();
  }

  public IndexSnapshot snapshot(String model, int version) {
    return db.sql(
            """
   SELECT count(*) FILTER(WHERE d.status='READY' AND
   """
                + FRESH
                + ") AS ready,count(*) AS total,count(*) FILTER(WHERE d.status='FAILED') AS failed,"
                + "coalesce(sum((SELECT count(*) FROM rag_chunks c WHERE c.article_id=a.id AND d.status='READY' AND "
                + FRESH
                + ")),0) AS chunks "
                + "FROM articles a JOIN sources s ON s.id=a.source_id LEFT JOIN rag_documents d ON d.article_id=a.id WHERE s.category IN ('NEWS','INSTITUTION')")
        .param("model", model)
        .param("version", version)
        .query(
            (r, n) ->
                new IndexSnapshot(
                    r.getLong("ready"),
                    r.getLong("total") - r.getLong("ready"),
                    r.getLong("failed"),
                    r.getLong("chunks")))
        .single();
  }

  public List<KnowledgeChunk> search(
      float[] embedding,
      String model,
      int version,
      KnowledgeScope scope,
      int limit,
      double minimumSimilarity) {
    String filters = "";
    Map<String, Object> params = new HashMap<>();
    params.put("vector", vector(embedding));
    params.put("model", model);
    params.put("version", version);
    params.put("days", scope.days());
    params.put("limit", limit);
    params.put("threshold", minimumSimilarity);
    if (scope.sourceId() != null) {
      filters += " AND a.source_id=:source";
      params.put("source", scope.sourceId());
    }
    if (scope.language() != null && !scope.language().isBlank()) {
      filters += " AND s.language=:language";
      params.put("language", scope.language());
    }
    return db.sql(
            """
   SELECT a.*,s.name AS source_name,s.language,s.region,s.category,c.id AS chunk_id,c.position,c.content,
   1-(c.embedding <=> CAST(:vector AS vector)) AS similarity
   FROM rag_chunks c JOIN rag_documents d ON d.article_id=c.article_id JOIN articles a ON a.id=d.article_id JOIN sources s ON s.id=a.source_id
   WHERE s.category IN ('NEWS','INSTITUTION') AND d.status='READY' AND
   """
                + FRESH
                + " AND coalesce(a.published_at,a.collected_at)>=now()-:days*interval '1 day'"
                + filters
                + " AND 1-(c.embedding <=> CAST(:vector AS vector))>=:threshold ORDER BY c.embedding <=> CAST(:vector AS vector),a.id,c.position LIMIT :limit")
        .params(params)
        .query(
            (r, n) ->
                new KnowledgeChunk(
                    r.getObject("chunk_id", UUID.class),
                    new Article(
                        r.getObject("id", UUID.class),
                        r.getObject("source_id", UUID.class),
                        r.getString("source_name"),
                        r.getString("language"),
                        r.getString("region"),
                        Source.Category.valueOf(r.getString("category")),
                        r.getString("title"),
                        r.getString("summary"),
                        r.getString("url"),
                        instant(r, "published_at"),
                        instant(r, "collected_at")),
                    r.getInt("position"),
                    r.getString("content"),
                    r.getDouble("similarity")))
        .list();
  }

  private static String vector(float[] values) {
    if (values.length != 1536) throw new IllegalArgumentException("Invalid embedding dimensions");
    List<String> numbers = new ArrayList<>();
    double norm = 0;
    for (float f : values) {
      if (!Float.isFinite(f)) throw new IllegalArgumentException("Invalid vector");
      numbers.add(Float.toString(f));
      norm += (double) f * f;
    }
    if (norm == 0) throw new IllegalArgumentException("Zero vector");
    return numbers.stream().collect(Collectors.joining(",", "[", "]"));
  }

  private static Instant instant(ResultSet r, String name) throws SQLException {
    Timestamp t = r.getTimestamp(name);
    return t == null ? null : t.toInstant();
  }
}
