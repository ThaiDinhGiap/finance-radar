package vn.financeradar.domain;

import java.time.Instant;
import java.util.List;

public record ChatAnswer(
    Status status,
    String message,
    List<ModelAnswer.Statement> statements,
    List<Article> sources,
    Instant answeredAt) {
  public enum Status {
    ANSWERED,
    NO_EVIDENCE,
    INSUFFICIENT_EVIDENCE
  }
}
