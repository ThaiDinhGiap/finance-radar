package vn.financeradar.infrastructure.crawl;

import com.rometools.rome.io.*;
import java.io.*;
import java.util.*;
import org.springframework.stereotype.Component;
import vn.financeradar.application.port.FeedConnector;
import vn.financeradar.domain.*;

@Component
public class RssConnector implements FeedConnector {
  private final SafeHttpFetcher http;

  public RssConnector(SafeHttpFetcher http) {
    this.http = http;
  }

  public Source.Kind kind() {
    return Source.Kind.RSS;
  }

  public List<FeedItem> fetch(Source source) throws Exception {
    return parse(http.fetch(source.url()));
  }

  public List<FeedItem> parse(byte[] bytes) throws Exception {
    SyndFeedInput input = new SyndFeedInput();
    input.setAllowDoctypes(false);
    try (XmlReader reader = new XmlReader(new ByteArrayInputStream(bytes))) {
      return input.build(reader).getEntries().stream()
          .limit(100)
          .map(
              entry ->
                  new FeedItem(
                      entry.getTitle(),
                      entry.getDescription() == null ? "" : entry.getDescription().getValue(),
                      entry.getLink(),
                      entry.getPublishedDate() == null
                          ? null
                          : entry.getPublishedDate().toInstant()))
          .toList();
    }
  }
}
