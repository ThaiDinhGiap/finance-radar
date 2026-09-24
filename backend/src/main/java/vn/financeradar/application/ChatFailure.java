package vn.financeradar.application;

public class ChatFailure extends RuntimeException {
  public enum Reason {
    NOT_CONFIGURED,
    BUSY,
    UPSTREAM,
    INVALID_EVIDENCE
  }

  private final Reason reason;

  public ChatFailure(Reason reason, String message) {
    super(message);
    this.reason = reason;
  }

  public Reason reason() {
    return reason;
  }
}
