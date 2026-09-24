package vn.financeradar;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

import java.time.Instant;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import tools.jackson.databind.ObjectMapper;
import vn.financeradar.application.ChatFailure;
import vn.financeradar.domain.*;
import vn.financeradar.infrastructure.ai.*;

class OpenRouterAnswerModelTest {
  private final ObjectMapper json = new ObjectMapper();
  private final OpenRouterHttpTransport http = mock(OpenRouterHttpTransport.class);
  private final OpenRouterAnswerModel model =
      new OpenRouterAnswerModel(http, json, "test-key", "inclusionai/ling-3.0-flash-vl:free");
  private final Article article =
      new Article(
          UUID.randomUUID(),
          UUID.randomUUID(),
          "Publisher",
          "vi",
          "VN",
          Source.Category.NEWS,
          "Giá vàng trong nước tăng",
          "Unretrieved text",
          "https://example.com",
          null,
          Instant.now());

  private List<KnowledgeChunk> chunks() {
    return List.of(new KnowledgeChunk(UUID.randomUUID(), article, 0, article.title(), 0.9));
  }

  private byte[] response(String finish, Map<String, Object> message) {
    return json.writeValueAsBytes(
        Map.of("choices", List.of(Map.of("finish_reason", finish, "message", message))));
  }

  @Test
  void sendsSelectedModelAndOnlyRetrievedContextWithoutUnsupportedParameters() {
    var expected =
        new ModelAnswer(
            false,
            List.of(
                new ModelAnswer.Statement(
                    "Theo bản tin, giá vàng tăng.",
                    List.of(new ModelAnswer.Evidence(article.id(), article.title())))));
    when(http.execute(any(), eq("test-key")))
        .thenReturn(
            response(
                "stop",
                Map.of(
                    "content",
                    json.writeValueAsString(expected),
                    "reasoning",
                    "private reasoning must not be returned")));
    assertThat(model.answer("Giá vàng?", List.of(), chunks())).isEqualTo(expected);
    var bytes = ArgumentCaptor.forClass(byte[].class);
    verify(http).execute(bytes.capture(), eq("test-key"));
    var payload = json.readTree(bytes.getValue());
    assertThat(payload.path("model").asText()).isEqualTo("inclusionai/ling-3.0-flash-vl:free");
    assertThat(payload.path("stream").asBoolean()).isFalse();
    assertThat(payload.has("response_format")).isFalse();
    assertThat(payload.has("tools")).isFalse();
    assertThat(payload.path("messages").get(0).path("content").asText())
        .contains("untrusted data", "ONLY source", "JSON object");
    var context = json.readTree(payload.path("messages").get(1).path("content").asText());
    assertThat(context.path("documents").get(0).path("content").asText())
        .isEqualTo(article.title());
    assertThat(payload.toString()).doesNotContain("test-key", article.summary());
  }

  @Test
  void rejectsTruncatedMalformedAndMissingRequiredFields() {
    for (byte[] response :
        List.of(
            response("length", Map.of("content", "{}")),
            response("stop", Map.of("content", "not json")),
            response("stop", Map.of("content", "{}")),
            json.writeValueAsBytes(Map.of("error", Map.of("message", "failed"))))) {
      when(http.execute(any(), anyString())).thenReturn(response);
      assertThatThrownBy(() -> model.answer("Question", List.of(), chunks()))
          .isInstanceOf(ChatFailure.class);
    }
  }

  @Test
  void acceptsJsonFenceAndHandlesRefusalWithoutExposingReasoning() {
    when(http.execute(any(), anyString()))
        .thenReturn(
            response(
                "stop",
                Map.of("content", "```json\n{\"insufficient\":true,\"statements\":[]}\n```")));
    assertThat(model.answer("Question", List.of(), chunks()))
        .isEqualTo(new ModelAnswer(true, List.of()));
    when(http.execute(any(), anyString()))
        .thenReturn(response("stop", Map.of("refusal", "No answer", "reasoning", "hidden")));
    assertThat(model.answer("Question", List.of(), chunks()))
        .isEqualTo(new ModelAnswer(true, List.of()));
  }
}
