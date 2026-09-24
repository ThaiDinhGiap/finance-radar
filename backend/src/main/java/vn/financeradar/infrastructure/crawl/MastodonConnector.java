package vn.financeradar.infrastructure.crawl;

import java.time.Instant;
import java.util.*;
import org.jsoup.Jsoup;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;
import vn.financeradar.application.port.FeedConnector;
import vn.financeradar.domain.*;

@Component
public class MastodonConnector implements FeedConnector {
  private final SafeHttpFetcher http;
  private final ObjectMapper json;

  public MastodonConnector(SafeHttpFetcher http, ObjectMapper json) {
    this.http = http;
    this.json = json;
  }

  public Source.Kind kind() {
    return Source.Kind.MASTODON;
  }

  public List<FeedItem> fetch(Source source) throws Exception {
    return parse(http.fetch(source.url()));
  }

  public List<FeedItem> parse(byte[] bytes) {
    var root = json.readTree(bytes);
    if (!root.isArray())
      throw new IllegalArgumentException("Mastodon API không trả danh sách bài viết công khai");
    List<FeedItem> items = new ArrayList<>();
    for (var node : root) {
      if (items.size() >= 100) break;
      String text = Jsoup.parse(node.path("content").asText("")).text();
      Instant published = null;
      try {
        published = Instant.parse(node.path("created_at").asText(""));
      } catch (Exception ignored) {
      }
      items.add(
          new FeedItem(
              text.substring(0, Math.min(180, text.length())),
              text,
              node.path("url").asText(""),
              published));
    }
    return items;
  }
}
