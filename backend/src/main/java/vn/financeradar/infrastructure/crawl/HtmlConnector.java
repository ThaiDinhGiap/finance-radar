package vn.financeradar.infrastructure.crawl;

import java.io.*;
import java.util.*;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Element;
import org.springframework.stereotype.Component;
import vn.financeradar.application.port.FeedConnector;
import vn.financeradar.domain.*;

@Component
public class HtmlConnector implements FeedConnector {
  private final SafeHttpFetcher http;

  public HtmlConnector(SafeHttpFetcher http) {
    this.http = http;
  }

  public Source.Kind kind() {
    return Source.Kind.HTML;
  }

  public List<FeedItem> fetch(Source source) throws Exception {
    return parse(http.fetch(source.url()), source);
  }

  public List<FeedItem> parse(byte[] bytes, Source s) throws Exception {
    var doc = Jsoup.parse(new ByteArrayInputStream(bytes), null, s.url());
    var nodes = doc.select(s.itemSelector());
    if (nodes.isEmpty()) throw new IOException("Không tìm thấy mục HTML; kiểm tra lại bộ chọn CSS");
    List<FeedItem> items = new ArrayList<>();
    for (Element node : nodes.stream().limit(100).toList()) {
      Element title = node.selectFirst(s.titleSelector()),
          link = node.selectFirst(s.linkSelector());
      Element summary =
          s.summarySelector() == null || s.summarySelector().isBlank()
              ? null
              : node.selectFirst(s.summarySelector());
      items.add(
          new FeedItem(
              title == null ? "" : title.text(),
              summary == null ? "" : summary.text(),
              link == null ? "" : link.absUrl("href"),
              null));
    }
    return items;
  }
}
