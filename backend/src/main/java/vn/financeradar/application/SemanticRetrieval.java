package vn.financeradar.application;

import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import vn.financeradar.application.port.*;
import vn.financeradar.domain.*;

@Service
public class SemanticRetrieval {
  private final VectorRepository vectors;
  private final EmbeddingModel embeddings;
  private final double minimumSimilarity;

  public SemanticRetrieval(
      VectorRepository vectors,
      EmbeddingModel embeddings,
      @Value("${radar.ai.minimum-similarity:0.3}") double minimumSimilarity) {
    if (!Double.isFinite(minimumSimilarity) || minimumSimilarity < 0 || minimumSimilarity > 1)
      throw new IllegalArgumentException("Invalid similarity threshold");
    this.vectors = vectors;
    this.embeddings = embeddings;
    this.minimumSimilarity = minimumSimilarity;
  }

  public boolean configured() {
    return embeddings.configured();
  }

  public String modelName() {
    return embeddings.modelName();
  }

  public IndexSnapshot status() {
    return vectors.snapshot(embeddings.modelName(), ArticleChunker.VERSION);
  }

  public List<KnowledgeChunk> retrieve(
      String question, List<String> previousQuestions, KnowledgeScope scope) {
    if (!configured())
      throw new ChatFailure(
          ChatFailure.Reason.NOT_CONFIGURED,
          "Chưa cấu hình OPENROUTER_API_KEY để lập chỉ mục và tìm kiếm ngữ nghĩa.");
    if (status().ready() == 0)
      throw new ChatFailure(
          ChatFailure.Reason.NOT_CONFIGURED,
          "Kho vector chưa sẵn sàng. Chờ lập chỉ mục hoặc kiểm tra cấu hình OpenRouter.");
    // Current question comes first; short follow-ups receive bounded conversational context.
    String query = question;
    if (question.length() < 80 && !previousQuestions.isEmpty())
      query += "\nPrevious question: " + previousQuestions.get(previousQuestions.size() - 1);
    var vector = embeddings.embed(List.of(query)).get(0);
    return vectors.search(
        vector, embeddings.modelName(), ArticleChunker.VERSION, scope, 8, minimumSimilarity);
  }
}
