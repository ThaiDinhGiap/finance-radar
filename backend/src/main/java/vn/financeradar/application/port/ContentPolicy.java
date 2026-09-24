package vn.financeradar.application.port;

import vn.financeradar.domain.FeedItem;

public interface ContentPolicy {
  void validateUrl(String url);

  FeedItem normalize(FeedItem item);

  String hash(String canonicalUrl);

  void validateSelector(String selector);
}
