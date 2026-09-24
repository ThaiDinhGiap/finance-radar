package vn.financeradar.domain;

import java.util.List;
import java.util.UUID;

public record ModelAnswer(boolean insufficient, List<Statement> statements) {
  public record Statement(String text, List<Evidence> evidence) {}

  public record Evidence(UUID articleId, String quote) {}
}
