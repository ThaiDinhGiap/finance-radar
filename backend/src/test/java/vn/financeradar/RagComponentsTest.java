package vn.financeradar;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

import java.util.*;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import tools.jackson.databind.ObjectMapper;
import vn.financeradar.application.*;
import vn.financeradar.application.port.*;
import vn.financeradar.domain.*;
import vn.financeradar.infrastructure.ai.*;

class RagComponentsTest {
  @Test
  void chunksBoundSizeOverlapAndPreserveAllText() {
    String title = "Báo cáo tài chính";
    String summary = "Đầu tư công và giải ngân. ".repeat(230);
    String input = (title + "\n\n" + summary).strip();
    var chunks = new ArticleChunker().split(title, summary);
    assertThat(chunks).hasSizeGreaterThan(2).allMatch(c -> c.length() <= 1200);
    assertThat(chunks.get(0)).startsWith(title);
    StringBuilder reconstructed = new StringBuilder(chunks.get(0));
    for (int i = 1; i < chunks.size(); i++) {
      assertThat(chunks.get(i))
          .startsWith(chunks.get(i - 1).substring(chunks.get(i - 1).length() - 180));
      reconstructed.append(chunks.get(i).substring(180));
    }
    assertThat(reconstructed.toString()).isEqualTo(input);
  }

  @Test
  void semanticQueryUsesEmbeddingsWithoutKeywordSearch() {
    var repo = mock(VectorRepository.class);
    var embed = mock(EmbeddingModel.class);
    when(embed.configured()).thenReturn(true);
    when(embed.modelName()).thenReturn("test");
    when(repo.snapshot("test", 1)).thenReturn(new IndexSnapshot(1, 0, 0, 1));
    float[] vector = new float[1536];
    vector[0] = 1;
    when(embed.embed(anyList())).thenReturn(List.of(vector));
    var scope = new KnowledgeScope(null, "", 30);
    new SemanticRetrieval(repo, embed, 0.3)
        .retrieve("Quy định giải ngân NSTW là gì?", List.of(), scope);
    verify(embed).embed(List.of("Quy định giải ngân NSTW là gì?"));
    verify(repo).search(vector, "test", 1, scope, 8, 0.3);
  }

  @Test
  void unavailableIndexNeverEmbedsQuery() {
    var repo = mock(VectorRepository.class);
    var embed = mock(EmbeddingModel.class);
    when(embed.configured()).thenReturn(true);
    when(embed.modelName()).thenReturn("test");
    when(repo.snapshot("test", 1)).thenReturn(new IndexSnapshot(0, 20, 0, 0));
    assertThatThrownBy(
            () ->
                new SemanticRetrieval(repo, embed, 0.3)
                    .retrieve("Question", List.of(), new KnowledgeScope(null, "", 30)))
        .isInstanceOf(ChatFailure.class);
    verify(embed, never()).embed(anyList());
  }

  @Test
  void embeddingAdapterChecksShapeAndPreservesProviderIndexes() {
    var http = mock(OpenRouterHttpTransport.class);
    var json = new ObjectMapper();
    var model = new OpenRouterEmbeddingModel(http, json, "test-key");
    float[] one = new float[1536], two = new float[1536];
    one[0] = 1;
    two[1] = 1;
    when(http.embeddings(any(), anyString()))
        .thenReturn(
            json.writeValueAsBytes(
                Map.of(
                    "data",
                    List.of(
                        Map.of("index", 1, "embedding", two),
                        Map.of("index", 0, "embedding", one)))));
    assertThat(model.embed(List.of("First document", "Second document"))).containsExactly(one, two);
    var bytes = ArgumentCaptor.forClass(byte[].class);
    verify(http).embeddings(bytes.capture(), eq("test-key"));
    var payload = json.readTree(bytes.getValue());
    assertThat(payload.path("model").asText()).isEqualTo("openai/text-embedding-3-small");
    assertThat(payload.path("dimensions").asInt()).isEqualTo(1536);
    assertThat(payload.path("encoding_format").asText()).isEqualTo("float");
    when(http.embeddings(any(), anyString()))
        .thenReturn(
            json.writeValueAsBytes(
                Map.of("data", List.of(Map.of("index", 0, "embedding", new float[1536])))));
    assertThatThrownBy(() -> model.embed(List.of("Zero vector"))).isInstanceOf(ChatFailure.class);
    when(http.embeddings(any(), anyString()))
        .thenReturn(
            json.writeValueAsBytes(
                Map.of("data", List.of(Map.of("index", 0, "embedding", List.of(1.0))))));
    assertThatThrownBy(() -> model.embed(List.of("Bad dimensions")))
        .isInstanceOf(ChatFailure.class);
  }

  @Test
  void indexerRetriesFailedDocumentsWithoutPublishingPartialChunks() {
    var repo = mock(VectorRepository.class);
    var embed = mock(EmbeddingModel.class);
    when(embed.configured()).thenReturn(true);
    when(embed.modelName()).thenReturn("test");
    var doc =
        new IndexDocument(UUID.randomUUID(), "Title", "Summary", "fingerprint", UUID.randomUUID());
    when(repo.claim("test", 1)).thenReturn(Optional.of(doc));
    when(embed.embed(anyList()))
        .thenThrow(new ChatFailure(ChatFailure.Reason.UPSTREAM, "Provider failed"));
    var indexer = new KnowledgeIndexer(repo, embed, new ArticleChunker());
    try {
      assertThat(indexer.indexNext()).isFalse();
      verify(repo).fail(eq(doc), anyString());
      verify(repo, never()).complete(any(), anyString(), anyInt(), anyList(), anyList());
    } finally {
      indexer.close();
    }
  }
}
