package vn.financeradar.domain;

import java.time.Instant;
import java.util.UUID;

public record CrawlRun(
    UUID id,
    UUID sourceId,
    String sourceName,
    String status,
    Instant createdAt,
    Instant startedAt,
    Instant finishedAt,
    int fetched,
    int inserted,
    int rejected,
    String message) {}
