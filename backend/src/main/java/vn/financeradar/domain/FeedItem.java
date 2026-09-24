package vn.financeradar.domain;

import java.time.Instant;

public record FeedItem(String title, String summary, String url, Instant publishedAt) {}
