package vn.financeradar.application.port;

import java.util.*;
import vn.financeradar.domain.*;

public interface RunRepository {
  void enqueue(UUID id, UUID sourceId);

  List<CrawlRun> queued();

  boolean start(UUID id);

  void finish(UUID id, String status, int fetched, int inserted, int rejected, String message);

  Page<CrawlRun> history(int page, int size);

  List<CrawlRun> expired();
}
