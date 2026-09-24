package vn.financeradar.domain;

import java.util.UUID;

public record KnowledgeScope(UUID sourceId, String language, int days) {}
