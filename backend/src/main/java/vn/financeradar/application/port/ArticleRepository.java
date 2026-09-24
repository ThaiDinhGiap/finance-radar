package vn.financeradar.application.port;

import java.util.UUID;
import vn.financeradar.domain.*;

public interface ArticleRepository {
  boolean insert(UUID sourceId, FeedItem item, String hash);

  Page<Article> search(
      String query, UUID sourceId, String language, String category, int page, int size);

  long count();
}
