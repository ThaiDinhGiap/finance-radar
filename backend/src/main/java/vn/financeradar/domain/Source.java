package vn.financeradar.domain;

import java.time.Instant;
import java.util.UUID;

public record Source(
    UUID id,
    String name,
    String url,
    Kind kind,
    Category category,
    String language,
    String region,
    boolean enabled,
    int intervalMinutes,
    String itemSelector,
    String titleSelector,
    String linkSelector,
    String summarySelector,
    UUID activeRunId,
    Instant nextRunAt,
    Instant lastSuccessAt,
    int failures) {
  public enum Kind {
    RSS,
    HTML,
    MASTODON
  }

  public enum Category {
    NEWS,
    INSTITUTION,
    FORUM,
    SOCIAL
  }
}
