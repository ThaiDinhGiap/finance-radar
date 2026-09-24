package vn.financeradar.application;

import java.time.Instant;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.financeradar.application.port.*;
import vn.financeradar.domain.*;

@Service
public class CatalogService {
  private final SourceRepository sources;
  private final ContentPolicy policy;

  public CatalogService(SourceRepository sources, ContentPolicy policy) {
    this.sources = sources;
    this.policy = policy;
  }

  public Source require(UUID id) {
    return sources.find(id).orElseThrow(() -> new NoSuchElementException("Không tìm thấy nguồn"));
  }

  public List<Source> list() {
    return sources.findAll();
  }

  @Transactional
  public Source create(
      String name,
      String url,
      Source.Kind kind,
      Source.Category category,
      String language,
      String region,
      int intervalMinutes,
      String item,
      String title,
      String link,
      String summary) {
    validate(url, kind, item, title, link, summary);
    Source source =
        new Source(
            UUID.randomUUID(),
            name.strip(),
            url.strip(),
            kind,
            category,
            language,
            region,
            false,
            intervalMinutes,
            item,
            title,
            link,
            summary,
            null,
            Instant.now(),
            null,
            0);
    sources.save(source);
    return require(source.id());
  }

  @Transactional
  public Source update(
      UUID id,
      String name,
      String url,
      Source.Kind kind,
      Source.Category category,
      String language,
      String region,
      int intervalMinutes,
      String item,
      String title,
      String link,
      String summary) {
    Source previous = require(id);
    validate(url, kind, item, title, link, summary);
    Source updated =
        new Source(
            id,
            name.strip(),
            url.strip(),
            kind,
            category,
            language,
            region,
            previous.enabled(),
            intervalMinutes,
            item,
            title,
            link,
            summary,
            null,
            previous.nextRunAt(),
            previous.lastSuccessAt(),
            0);
    if (!sources.update(updated))
      throw new IllegalStateException("Chờ lượt thu thập hiện tại kết thúc trước khi sửa nguồn");
    return require(id);
  }

  private void validate(
      String url, Source.Kind kind, String item, String title, String link, String summary) {
    policy.validateUrl(url);
    if (kind == Source.Kind.HTML) {
      if (item == null
          || title == null
          || link == null
          || item.isBlank()
          || title.isBlank()
          || link.isBlank())
        throw new IllegalArgumentException("Nguồn HTML cần bộ chọn mục, tiêu đề và liên kết");
      for (String selector : List.of(item, title, link)) policy.validateSelector(selector);
      if (summary != null && !summary.isBlank()) policy.validateSelector(summary);
    }
  }

  @Transactional
  public void setEnabled(UUID id, boolean enabled) {
    require(id);
    sources.setEnabled(id, enabled);
  }
}
