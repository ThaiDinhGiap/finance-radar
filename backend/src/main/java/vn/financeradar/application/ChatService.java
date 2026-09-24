package vn.financeradar.application;

import java.time.Instant;
import java.util.List;
import org.springframework.stereotype.Service;
import vn.financeradar.application.port.*;
import vn.financeradar.domain.*;

@Service
public class ChatService {
  private final KnowledgeRepository knowledge;
  private final SemanticRetrieval retrieval;
  private final AnswerModel model;
  private final CitationVerifier verifier;
  private final ChatCapacity capacity;

  public ChatService(
      KnowledgeRepository knowledge,
      SemanticRetrieval retrieval,
      AnswerModel model,
      CitationVerifier verifier,
      ChatCapacity capacity) {
    this.knowledge = knowledge;
    this.retrieval = retrieval;
    this.model = model;
    this.verifier = verifier;
    this.capacity = capacity;
  }

  public record Status(
      boolean configured,
      String provider,
      String model,
      KnowledgeSnapshot knowledge,
      String embeddingModel,
      IndexSnapshot index) {}

  public Status status() {
    return new Status(
        model.configured() && retrieval.configured(),
        "OpenRouter",
        model.modelName(),
        knowledge.snapshot(),
        retrieval.modelName(),
        retrieval.status());
  }

  public List<Article> retrieve(
      String question, List<String> previousQuestions, KnowledgeScope scope) {
    capacity.acquire();
    try {
      return retrieval.retrieve(question, previousQuestions, scope).stream()
          .map(KnowledgeChunk::article)
          .distinct()
          .toList();
    } finally {
      capacity.release();
    }
  }

  public ChatAnswer answer(String question, List<String> previousQuestions, KnowledgeScope scope) {
    capacity.acquire();
    try {
      List<KnowledgeChunk> chunks = retrieval.retrieve(question, previousQuestions, scope);
      List<Article> candidates = chunks.stream().map(KnowledgeChunk::article).distinct().toList();
      if (candidates.isEmpty())
        return new ChatAnswer(
            ChatAnswer.Status.NO_EVIDENCE,
            "Chưa tìm thấy bài phù hợp trong dữ liệu đã thu thập. Hãy nêu rõ chủ đề, đổi bộ lọc hoặc bổ sung nguồn; tôi không có căn cứ để trả lời.",
            List.of(),
            List.of(),
            Instant.now());
      if (!model.configured())
        throw new ChatFailure(
            ChatFailure.Reason.NOT_CONFIGURED,
            "Chưa cấu hình OPENROUTER_API_KEY trên máy chủ. Hãy cấu hình khóa để sử dụng RAG.");
      ModelAnswer generated = model.answer(question, previousQuestions, chunks);
      List<Article> cited = verifier.verify(generated, chunks);
      if (generated.insufficient())
        return new ChatAnswer(
            ChatAnswer.Status.INSUFFICIENT_EVIDENCE,
            "Các bài tìm được chưa đủ thông tin để trả lời câu hỏi này. Tôi chỉ có tiêu đề và tóm tắt đã lưu; bạn có thể đối chiếu các bài dưới đây.",
            List.of(),
            candidates,
            Instant.now());
      return new ChatAnswer(
          ChatAnswer.Status.ANSWERED,
          "Câu trả lời dựa trên tiêu đề và tóm tắt đã thu thập; hãy đối chiếu bài gốc.",
          generated.statements(),
          cited,
          Instant.now());
    } finally {
      capacity.release();
    }
  }
}
