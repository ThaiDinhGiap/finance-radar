package vn.financeradar.infrastructure.persistence;

import java.sql.*;
import java.time.Instant;
import java.util.*;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import vn.financeradar.application.port.KnowledgeRepository;
import vn.financeradar.domain.*;

@Repository
public class JdbcKnowledgeRepository implements KnowledgeRepository {
  private final JdbcClient db;

  public JdbcKnowledgeRepository(JdbcClient db) {
    this.db = db;
  }

  public KnowledgeSnapshot snapshot() {
    return db.sql(
            """
        SELECT count(*) AS articles,count(DISTINCT a.source_id) AS sources,max(a.collected_at) AS latest
        FROM articles a JOIN sources s ON s.id=a.source_id WHERE s.category IN ('NEWS','INSTITUTION')
        """)
        .query(
            (r, n) ->
                new KnowledgeSnapshot(
                    r.getLong("articles"), r.getLong("sources"), instant(r, "latest")))
        .single();
  }

  private static Instant instant(ResultSet r, String name) throws SQLException {
    Timestamp value = r.getTimestamp(name);
    return value == null ? null : value.toInstant();
  }
}
