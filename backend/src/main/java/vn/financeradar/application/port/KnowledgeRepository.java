package vn.financeradar.application.port;

import vn.financeradar.domain.KnowledgeSnapshot;

public interface KnowledgeRepository {
  KnowledgeSnapshot snapshot();
}
