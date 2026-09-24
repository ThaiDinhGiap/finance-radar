package vn.financeradar.application.port;

import java.util.*;
import vn.financeradar.domain.*;

public interface VectorRepository {
  Optional<IndexDocument> claim(String model, int version);

  boolean complete(
      IndexDocument document,
      String model,
      int version,
      List<String> chunks,
      List<float[]> vectors);

  void fail(IndexDocument document, String message);

  IndexSnapshot snapshot(String model, int version);

  List<KnowledgeChunk> search(
      float[] vector,
      String model,
      int version,
      KnowledgeScope scope,
      int limit,
      double minimumSimilarity);
}
