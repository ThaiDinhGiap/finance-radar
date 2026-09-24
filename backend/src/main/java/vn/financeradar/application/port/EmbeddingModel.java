package vn.financeradar.application.port;

import java.util.List;

public interface EmbeddingModel {
  boolean configured();

  String modelName();

  List<float[]> embed(List<String> texts);
}
