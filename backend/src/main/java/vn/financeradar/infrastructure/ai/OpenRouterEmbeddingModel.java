package vn.financeradar.infrastructure.ai;

import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;
import vn.financeradar.application.ChatFailure;
import vn.financeradar.application.port.EmbeddingModel;

@Component
public class OpenRouterEmbeddingModel implements EmbeddingModel {
  public static final int DIMENSIONS = 1536;
  private final OpenRouterHttpTransport transport;
  private final ObjectMapper json;
  private final String key;

  public OpenRouterEmbeddingModel(
      OpenRouterHttpTransport transport,
      ObjectMapper json,
      @Value("${radar.ai.api-key:}") String key) {
    this.transport = transport;
    this.json = json;
    this.key = key.strip();
  }

  public boolean configured() {
    return !key.isBlank();
  }

  public String modelName() {
    return "openai/text-embedding-3-small";
  }

  public List<float[]> embed(List<String> texts) {
    if (!configured())
      throw new ChatFailure(
          ChatFailure.Reason.NOT_CONFIGURED, "Chưa cấu hình OPENROUTER_API_KEY để tạo embedding.");
    if (texts.isEmpty()
        || texts.size() > 32
        || texts.stream().anyMatch(t -> t.isBlank() || t.length() > 6500))
      throw new IllegalArgumentException("Invalid embedding batch");
    byte[] response =
        transport.embeddings(
            json.writeValueAsBytes(
                Map.of(
                    "model",
                    modelName(),
                    "input",
                    texts,
                    "dimensions",
                    DIMENSIONS,
                    "encoding_format",
                    "float")),
            key);
    try {
      var data = json.readTree(response).path("data");
      if (!data.isArray() || data.size() != texts.size()) throw new IllegalArgumentException();
      float[][] vectors = new float[texts.size()][];
      for (var item : data) {
        int index = item.path("index").asInt(-1);
        var embedding = item.path("embedding");
        if (index < 0
            || index >= vectors.length
            || vectors[index] != null
            || !embedding.isArray()
            || embedding.size() != DIMENSIONS) throw new IllegalArgumentException();
        float[] vector = new float[DIMENSIONS];
        double norm = 0;
        for (int i = 0; i < DIMENSIONS; i++) {
          if (!embedding.get(i).isNumber()) throw new IllegalArgumentException();
          vector[i] = (float) embedding.get(i).asDouble();
          if (!Float.isFinite(vector[i])) throw new IllegalArgumentException();
          norm += (double) vector[i] * vector[i];
        }
        if (norm == 0) throw new IllegalArgumentException();
        vectors[index] = vector;
      }
      return Arrays.asList(vectors);
    } catch (RuntimeException e) {
      throw new ChatFailure(
          ChatFailure.Reason.UPSTREAM,
          "OpenRouter trả embedding không hợp lệ; dữ liệu chưa được lập chỉ mục.");
    }
  }
}
