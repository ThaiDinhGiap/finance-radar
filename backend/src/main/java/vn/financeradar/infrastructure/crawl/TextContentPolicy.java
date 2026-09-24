package vn.financeradar.infrastructure.crawl;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.time.Instant;
import java.util.*;
import org.jsoup.Jsoup;
import org.jsoup.select.Selector;
import org.springframework.stereotype.Component;
import vn.financeradar.application.port.ContentPolicy;
import vn.financeradar.domain.FeedItem;

@Component
public class TextContentPolicy implements ContentPolicy {
  private final PublicUrlPolicy urls;

  public TextContentPolicy(PublicUrlPolicy urls) {
    this.urls = urls;
  }

  public void validateUrl(String url) {
    urls.validate(url);
  }

  public void validateSelector(String selector) {
    try {
      Selector.select(selector, Jsoup.parse("<main></main>"));
    } catch (Exception e) {
      throw new IllegalArgumentException("Bộ chọn CSS không hợp lệ");
    }
  }

  public FeedItem normalize(FeedItem item) {
    String title = plain(item.title(), 500);
    if (title.isBlank()) throw new IllegalArgumentException("Thiếu tiêu đề");
    String url = canonical(item.url());
    Instant published = item.publishedAt();
    if (published != null && published.isAfter(Instant.now().plusSeconds(86400))) published = null;
    return new FeedItem(title, plain(item.summary(), 1500), url, published);
  }

  public String canonical(String input) {
    URI uri = urls.validate(input);
    String query = uri.getRawQuery();
    if (query != null) {
      query =
          Arrays.stream(query.split("&"))
              .filter(
                  p -> {
                    String key = p.split("=", 2)[0].toLowerCase(Locale.ROOT);
                    return !key.startsWith("utm_")
                        && !Set.of("fbclid", "gclid", "mc_cid", "mc_eid").contains(key);
                  })
              .reduce((a, b) -> a + "&" + b)
              .orElse("");
    }
    String host = uri.getHost().toLowerCase(Locale.ROOT);
    String path = uri.getRawPath();
    return "https://"
        + host
        + (path == null || path.isEmpty() ? "/" : path)
        + (query == null || query.isEmpty() ? "" : "?" + query);
  }

  private String plain(String html, int max) {
    String text = Jsoup.parse(html == null ? "" : html).text().strip();
    return text.substring(0, Math.min(max, text.length()));
  }

  public String hash(String canonicalUrl) {
    try {
      return HexFormat.of()
          .formatHex(
              MessageDigest.getInstance("SHA-256")
                  .digest(canonicalUrl.getBytes(StandardCharsets.UTF_8)));
    } catch (NoSuchAlgorithmException e) {
      throw new IllegalStateException(e);
    }
  }
}
