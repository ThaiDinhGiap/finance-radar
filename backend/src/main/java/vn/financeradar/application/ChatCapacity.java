package vn.financeradar.application;

import java.time.Instant;
import java.util.ArrayDeque;
import org.springframework.stereotype.Component;

@Component
public class ChatCapacity {
  private final ArrayDeque<Instant> calls = new ArrayDeque<>();
  private int active;

  public synchronized void acquire() {
    Instant cutoff = Instant.now().minusSeconds(60);
    while (!calls.isEmpty() && calls.peekFirst().isBefore(cutoff)) calls.removeFirst();
    if (active >= 2 || calls.size() >= 12)
      throw new ChatFailure(
          ChatFailure.Reason.BUSY, "Chat đang bận hoặc đã đạt 12 lượt/phút. Vui lòng thử lại sau.");
    active++;
    calls.addLast(Instant.now());
  }

  public synchronized void release() {
    active--;
  }
}
