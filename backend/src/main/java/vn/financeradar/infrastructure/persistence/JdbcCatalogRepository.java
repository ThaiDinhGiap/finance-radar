package vn.financeradar.infrastructure.persistence;

import java.sql.*;
import java.time.Instant;
import java.util.*;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import vn.financeradar.application.port.*;
import vn.financeradar.domain.*;

@Repository
public class JdbcCatalogRepository implements SourceRepository, ArticleRepository, RunRepository {
  private final JdbcClient db;

  public JdbcCatalogRepository(JdbcClient db) {
    this.db = db;
  }

  private static Instant instant(ResultSet r, String name) throws SQLException {
    Timestamp value = r.getTimestamp(name);
    return value == null ? null : value.toInstant();
  }

  private static final RowMapper<Source> SOURCE =
      (r, n) ->
          new Source(
              r.getObject("id", UUID.class),
              r.getString("name"),
              r.getString("url"),
              Source.Kind.valueOf(r.getString("kind")),
              Source.Category.valueOf(r.getString("category")),
              r.getString("language"),
              r.getString("region"),
              r.getBoolean("enabled"),
              r.getInt("interval_minutes"),
              r.getString("item_selector"),
              r.getString("title_selector"),
              r.getString("link_selector"),
              r.getString("summary_selector"),
              r.getObject("active_run_id", UUID.class),
              instant(r, "next_run_at"),
              instant(r, "last_success_at"),
              r.getInt("failures"));
  private static final RowMapper<CrawlRun> RUN =
      (r, n) ->
          new CrawlRun(
              r.getObject("id", UUID.class),
              r.getObject("source_id", UUID.class),
              r.getString("source_name"),
              r.getString("status"),
              instant(r, "created_at"),
              instant(r, "started_at"),
              instant(r, "finished_at"),
              r.getInt("fetched"),
              r.getInt("inserted"),
              r.getInt("rejected"),
              r.getString("message"));
  private static final RowMapper<Article> ARTICLE =
      (r, n) ->
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
              instant(r, "collected_at"));

  public List<Source> findAll() {
    return db.sql("SELECT * FROM sources ORDER BY created_at,id").query(SOURCE).list();
  }

  public Optional<Source> find(UUID id) {
    return db.sql("SELECT * FROM sources WHERE id=:id").param("id", id).query(SOURCE).optional();
  }

  public void save(Source s) {
    db.sql(
            """
            INSERT INTO sources(id,name,url,kind,category,language,region,enabled,interval_minutes,
            item_selector,title_selector,link_selector,summary_selector) VALUES
            (:id,:name,:url,:kind,:category,:language,:region,:enabled,:minutes,:item,:title,:link,:summary)
            """)
        .param("id", s.id())
        .param("name", s.name())
        .param("url", s.url())
        .param("kind", s.kind().name())
        .param("category", s.category().name())
        .param("language", s.language())
        .param("region", s.region())
        .param("enabled", s.enabled())
        .param("minutes", s.intervalMinutes())
        .param("item", s.itemSelector())
        .param("title", s.titleSelector())
        .param("link", s.linkSelector())
        .param("summary", s.summarySelector())
        .update();
  }

  public boolean update(Source s) {
    return db.sql(
                """
            UPDATE sources SET name=:name,url=:url,kind=:kind,category=:category,language=:language,
            region=:region,interval_minutes=:minutes,item_selector=:item,title_selector=:title,
            link_selector=:link,summary_selector=:summary,next_run_at=now(),failures=0
            WHERE id=:id AND active_run_id IS NULL
            """)
            .param("id", s.id())
            .param("name", s.name())
            .param("url", s.url())
            .param("kind", s.kind().name())
            .param("category", s.category().name())
            .param("language", s.language())
            .param("region", s.region())
            .param("minutes", s.intervalMinutes())
            .param("item", s.itemSelector())
            .param("title", s.titleSelector())
            .param("link", s.linkSelector())
            .param("summary", s.summarySelector())
            .update()
        == 1;
  }

  public void setEnabled(UUID id, boolean enabled) {
    db.sql("UPDATE sources SET enabled=:enabled WHERE id=:id")
        .param("id", id)
        .param("enabled", enabled)
        .update();
  }

  public List<UUID> dueSources() {
    return db.sql(
            "SELECT id FROM sources WHERE enabled AND active_run_id IS NULL AND next_run_at<=now() ORDER BY next_run_at LIMIT 20")
        .query(UUID.class)
        .list();
  }

  public boolean acquire(UUID sourceId, UUID runId) {
    return db.sql(
                """
            UPDATE sources SET active_run_id=:run WHERE id=:source AND enabled AND active_run_id IS NULL
            AND NOT EXISTS(SELECT 1 FROM crawl_runs WHERE source_id=:source AND created_at>now()-interval '60 seconds')
            """)
            .param("source", sourceId)
            .param("run", runId)
            .update()
        == 1;
  }

  public boolean owns(UUID sourceId, UUID runId) {
    return db.sql("SELECT id FROM sources WHERE id=:id AND active_run_id=:run FOR UPDATE")
        .param("id", sourceId)
        .param("run", runId)
        .query(UUID.class)
        .optional()
        .isPresent();
  }

  public void release(UUID sourceId, UUID runId, boolean success, int retryMinutes) {
    db.sql(
            """
            UPDATE sources SET active_run_id=NULL,
            failures=CASE WHEN :success THEN 0 ELSE failures+1 END,
            last_success_at=CASE WHEN :success THEN now() ELSE last_success_at END,
            next_run_at=now()+(CASE WHEN :success THEN interval_minutes ELSE :retry END)*interval '1 minute'
            WHERE id=:source AND active_run_id=:run
            """)
        .param("source", sourceId)
        .param("run", runId)
        .param("success", success)
        .param("retry", retryMinutes)
        .update();
  }

  public boolean insert(UUID sourceId, FeedItem i, String hash) {
    return db.sql(
                """
            INSERT INTO articles(id,source_id,title,summary,url,url_hash,published_at)
            VALUES (:id,:source,:title,:summary,:url,:hash,:published) ON CONFLICT(url_hash) DO NOTHING
            """)
            .param("id", UUID.randomUUID())
            .param("source", sourceId)
            .param("title", i.title())
            .param("summary", i.summary())
            .param("url", i.url())
            .param("hash", hash)
            .param("published", i.publishedAt() == null ? null : Timestamp.from(i.publishedAt()))
            .update()
        == 1;
  }

  public Page<Article> search(
      String query, UUID sourceId, String language, String category, int page, int size) {
    StringBuilder where = new StringBuilder(" WHERE 1=1");
    Map<String, Object> params = new HashMap<>();
    if (query != null && !query.isBlank()) {
      where.append(
          " AND to_tsvector('simple',a.title || ' ' || a.summary) @@ plainto_tsquery('simple',:q)");
      params.put("q", query.strip());
    }
    if (sourceId != null) {
      where.append(" AND a.source_id=:source");
      params.put("source", sourceId);
    }
    if (language != null && !language.isBlank()) {
      where.append(" AND s.language=:language");
      params.put("language", language);
    }
    if (category != null && !category.isBlank()) {
      where.append(" AND s.category=:category");
      params.put("category", category);
    }
    String from = " FROM articles a JOIN sources s ON s.id=a.source_id" + where;
    long total = db.sql("SELECT count(*)" + from).params(params).query(Long.class).single();
    List<Article> items =
        db.sql(
                "SELECT a.*,s.name AS source_name,s.language,s.region,s.category"
                    + from
                    + " ORDER BY a.collected_at DESC,a.id DESC LIMIT :limit OFFSET :offset")
            .params(params)
            .param("limit", size)
            .param("offset", (long) page * size)
            .query(ARTICLE)
            .list();
    return new Page<>(items, total, page, size);
  }

  public long count() {
    return db.sql("SELECT count(*) FROM articles").query(Long.class).single();
  }

  public void enqueue(UUID id, UUID sourceId) {
    db.sql("INSERT INTO crawl_runs(id,source_id,status) VALUES (:id,:source,'QUEUED')")
        .param("id", id)
        .param("source", sourceId)
        .update();
  }

  private static final String RUN_FROM = " FROM crawl_runs r JOIN sources s ON s.id=r.source_id ";

  public List<CrawlRun> queued() {
    return db.sql(
            "SELECT r.*,s.name AS source_name"
                + RUN_FROM
                + "WHERE r.status='QUEUED' ORDER BY r.created_at LIMIT 5")
        .query(RUN)
        .list();
  }

  public boolean start(UUID id) {
    return db.sql(
                "UPDATE crawl_runs SET status='RUNNING',started_at=now() WHERE id=:id AND status='QUEUED'")
            .param("id", id)
            .update()
        == 1;
  }

  public void finish(
      UUID id, String status, int fetched, int inserted, int rejected, String message) {
    db.sql(
            """
            UPDATE crawl_runs SET status=:status,finished_at=now(),fetched=:fetched,inserted=:inserted,rejected=:rejected,message=:message
            WHERE id=:id AND status IN ('QUEUED','RUNNING')
            """)
        .param("id", id)
        .param("status", status)
        .param("fetched", fetched)
        .param("inserted", inserted)
        .param("rejected", rejected)
        .param("message", message)
        .update();
  }

  public Page<CrawlRun> history(int page, int size) {
    long total = db.sql("SELECT count(*) FROM crawl_runs").query(Long.class).single();
    List<CrawlRun> items =
        db.sql(
                "SELECT r.*,s.name AS source_name"
                    + RUN_FROM
                    + "ORDER BY r.created_at DESC,r.id DESC LIMIT :limit OFFSET :offset")
            .param("limit", size)
            .param("offset", (long) page * size)
            .query(RUN)
            .list();
    return new Page<>(items, total, page, size);
  }

  public List<CrawlRun> expired() {
    return db.sql(
            "SELECT r.*,s.name AS source_name"
                + RUN_FROM
                + "WHERE r.status IN ('QUEUED','RUNNING') AND coalesce(r.started_at,r.created_at)<now()-interval '10 minutes'")
        .query(RUN)
        .list();
  }
}
