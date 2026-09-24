package vn.financeradar.domain;

import java.time.Instant;
import java.util.UUID;

public record Article(
    UUID id,
    UUID sourceId,
    String sourceName,
    String language,
    String region,
    Source.Category category,
    String title,
    String summary,
    String url,
    Instant publishedAt,
    Instant collectedAt) {}
