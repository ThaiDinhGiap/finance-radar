package vn.financeradar;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

import java.time.Instant;
import java.util.*;
import org.junit.jupiter.api.Test;
import vn.financeradar.application.*;
import vn.financeradar.application.port.*;
import vn.financeradar.domain.*;

class ChatServiceTest {
  private final KnowledgeRepository knowledge = mock(KnowledgeRepository.class);
  private final SemanticRetrieval retrieval = mock(SemanticRetrieval.class);
  private final AnswerModel model = mock(AnswerModel.class);
  private final CitationVerifier verifier = new CitationVerifier();
  private final ChatService service =
      new ChatService(knowledge, retrieval, model, verifier, new ChatCapacity());
  private final Article article =
      new Article(
          UUID.randomUUID(),
          UUID.randomUUID(),
          "Test news",
          "vi",
          "VN",
          Source.Category.NEWS,
          "Giá vàng tăng trong tuần",
          "Giá vàng trong nước tăng theo thị trường quốc tế.",
          "https://example.com/gold",
          Instant.now(),
          Instant.now());
  private final KnowledgeScope scope = new KnowledgeScope(null, "", 30);

  private ModelAnswer grounded() {
    return new ModelAnswer(
        false,
        List.of(
            new ModelAnswer.Statement(
                "Theo bản tin, giá vàng trong nước tăng.",
                List.of(
                    new ModelAnswer.Evidence(
                        article.id(), "Giá vàng trong nước tăng theo thị trường quốc tế.")))));
  }

  @Test
  void returnsNoEvidenceWithoutCallingModel() {
    when(retrieval.retrieve(anyString(), anyList(), eq(scope))).thenReturn(List.of());
    var answer = service.answer("Tình hình vàng?", List.of(), scope);
    assertThat(answer.status()).isEqualTo(ChatAnswer.Status.NO_EVIDENCE);
    verifyNoInteractions(model);
  }

  @Test
  void missingKeyNeverFabricatesAnAnswer() {
    when(retrieval.retrieve(anyString(), anyList(), eq(scope))).thenReturn(List.of(chunk()));
    when(model.configured()).thenReturn(false);
    assertThatThrownBy(() -> service.answer("Giá vàng?", List.of(), scope))
        .isInstanceOf(ChatFailure.class)
        .extracting(e -> ((ChatFailure) e).reason())
        .isEqualTo(ChatFailure.Reason.NOT_CONFIGURED);
    verify(model, never()).answer(anyString(), anyList(), anyList());
  }

  @Test
  void returnsOnlyServerResolvedCitations() {
    when(retrieval.retrieve(anyString(), anyList(), eq(scope))).thenReturn(List.of(chunk()));
    when(model.configured()).thenReturn(true);
    when(model.answer(anyString(), anyList(), anyList())).thenReturn(grounded());
    var answer = service.answer("Giá vàng?", List.of(), scope);
    assertThat(answer.status()).isEqualTo(ChatAnswer.Status.ANSWERED);
    assertThat(answer.sources()).containsExactly(article);
    assertThat(answer.sources().get(0).url()).isEqualTo("https://example.com/gold");
  }

  @Test
  void modelCanAbstainWhenSnippetsDoNotAnswerTheQuestion() {
    when(retrieval.retrieve(anyString(), anyList(), eq(scope))).thenReturn(List.of(chunk()));
    when(model.configured()).thenReturn(true);
    when(model.answer(anyString(), anyList(), anyList()))
        .thenReturn(new ModelAnswer(true, List.of()));
    var answer = service.answer("Giá vàng ngay lúc này?", List.of(), scope);
    assertThat(answer.status()).isEqualTo(ChatAnswer.Status.INSUFFICIENT_EVIDENCE);
    assertThat(answer.statements()).isEmpty();
  }

  @Test
  void rejectsInventedSourceAndFabricatedQuote() {
    var missingSource =
        new ModelAnswer(
            false,
            List.of(
                new ModelAnswer.Statement(
                    "Claim",
                    List.of(new ModelAnswer.Evidence(UUID.randomUUID(), article.title())))));
    var inventedQuote =
        new ModelAnswer(
            false,
            List.of(
                new ModelAnswer.Statement(
                    "Claim",
                    List.of(
                        new ModelAnswer.Evidence(
                            article.id(), "Giá vàng chắc chắn sẽ tăng gấp đôi ngày mai")))));
    assertThatThrownBy(() -> verifier.verify(missingSource, List.of(chunk())))
        .isInstanceOf(ChatFailure.class);
    assertThatThrownBy(() -> verifier.verify(inventedQuote, List.of(chunk())))
        .isInstanceOf(ChatFailure.class);
  }

  @Test
  void rejectsUncitedStatementsAndContradictoryAbstention() {
    assertThatThrownBy(
            () ->
                verifier.verify(
                    new ModelAnswer(
                        false, List.of(new ModelAnswer.Statement("Unsupported", List.of()))),
                    List.of(chunk())))
        .isInstanceOf(ChatFailure.class);
    assertThatThrownBy(
            () -> verifier.verify(new ModelAnswer(true, grounded().statements()), List.of(chunk())))
        .isInstanceOf(ChatFailure.class);
  }

  private KnowledgeChunk chunk() {
    return new KnowledgeChunk(
        UUID.randomUUID(), article, 0, article.title() + "\n" + article.summary(), 0.8);
  }

  @Test
  void rejectsQuotesFromUnretrievedPartsOfAnArticle() {
    var onlyTitle = new KnowledgeChunk(UUID.randomUUID(), article, 0, article.title(), 0.8);
    assertThatThrownBy(() -> verifier.verify(grounded(), List.of(onlyTitle)))
        .isInstanceOf(ChatFailure.class);
  }

  @Test
  void simultaneousPaidCallsAreBoundedAndReleased() {
    var capacity = new ChatCapacity();
    capacity.acquire();
    capacity.acquire();
    assertThatThrownBy(capacity::acquire).isInstanceOf(ChatFailure.class);
    capacity.release();
    assertThatCode(capacity::acquire).doesNotThrowAnyException();
  }
}
