package vn.financeradar.domain;

import java.util.UUID;

public record IndexDocument(
    UUID articleId, String title, String summary, String fingerprint, UUID lease) {}
