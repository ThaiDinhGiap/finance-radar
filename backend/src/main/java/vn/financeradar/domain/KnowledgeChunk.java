package vn.financeradar.domain;

import java.util.UUID;

public record KnowledgeChunk(
    UUID id, Article article, int position, String content, double similarity) {}
