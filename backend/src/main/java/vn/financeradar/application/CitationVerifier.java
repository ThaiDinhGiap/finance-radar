package vn.financeradar.application;

import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;
import vn.financeradar.domain.*;

@Component
public class CitationVerifier {
  public List<Article> verify(ModelAnswer answer, List<KnowledgeChunk> candidates) {
    if (answer == null || answer.statements() == null) throw invalid();
    if (answer.insufficient()) {
      if (!answer.statements().isEmpty()) throw invalid();
      return List.of();
    }
    if (answer.statements().isEmpty() || answer.statements().size() > 6) throw invalid();
    Map<UUID, Article> allowed =
        candidates.stream()
            .map(KnowledgeChunk::article)
            .distinct()
            .collect(Collectors.toMap(Article::id, Function.identity()));
    Set<UUID> cited = new LinkedHashSet<>();
    for (var statement : answer.statements()) {
      if (statement == null
          || statement.text() == null
          || statement.text().isBlank()
          || statement.text().length() > 2000
          || statement.evidence() == null
          || statement.evidence().isEmpty()
          || statement.evidence().size() > 3) throw invalid();
      for (var evidence : statement.evidence()) {
        if (evidence == null || evidence.quote() == null) throw invalid();
        Article article = allowed.get(evidence.articleId());
        String quote = normalize(evidence.quote());
        if (article == null
            || quote.length() < 12
            || quote.length() > 1500
            || candidates.stream()
                .noneMatch(
                    chunk ->
                        chunk.article().id().equals(article.id())
                            && normalize(chunk.content()).contains(quote))) throw invalid();
        cited.add(article.id());
      }
    }
    return cited.stream().map(allowed::get).toList();
  }

  private String normalize(String value) {
    return value.replaceAll("\\s+", " ").strip();
  }

  private ChatFailure invalid() {
    return new ChatFailure(
        ChatFailure.Reason.INVALID_EVIDENCE,
        "AI trả dẫn chứng không khớp dữ liệu nguồn. Câu trả lời đã bị chặn; hãy thử lại hoặc đọc các bài liên quan.");
  }
}
