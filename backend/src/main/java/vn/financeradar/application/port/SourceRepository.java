package vn.financeradar.application.port;

import java.util.*;
import vn.financeradar.domain.Source;

public interface SourceRepository {
  List<Source> findAll();

  Optional<Source> find(UUID id);

  void save(Source source);

  boolean update(Source source);

  void setEnabled(UUID id, boolean enabled);

  List<UUID> dueSources();

  boolean acquire(UUID sourceId, UUID runId);

  boolean owns(UUID sourceId, UUID runId);

  void release(UUID sourceId, UUID runId, boolean success, int retryMinutes);
}
