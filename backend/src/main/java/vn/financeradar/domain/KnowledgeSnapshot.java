package vn.financeradar.domain;

import java.time.Instant;

public record KnowledgeSnapshot(long articles, long sources, Instant lastCollectedAt) {}
