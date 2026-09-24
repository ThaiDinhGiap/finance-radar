package vn.financeradar.application.port;

import java.util.List;
import vn.financeradar.domain.*;

public interface AnswerModel {
  boolean configured();

  String modelName();

  ModelAnswer answer(
      String question, List<String> previousQuestions, List<KnowledgeChunk> evidence);
}
