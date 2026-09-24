package vn.financeradar.application;

import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.financeradar.application.port.*;
import vn.financeradar.domain.*;

@Service
public class CrawlTransactions {
  private final SourceRepository sources;
  private final RunRepository runs;
  private final ArticleRepository articles;
  private final ContentPolicy policy;

  public CrawlTransactions(
      SourceRepository sources,
      RunRepository runs,
      ArticleRepository articles,
      ContentPolicy policy) {
    this.sources = sources;
    this.runs = runs;
    this.articles = articles;
    this.policy = policy;
  }

  @Transactional
  public UUID enqueue(UUID sourceId) {
    Source source =
        sources
            .find(sourceId)
            .orElseThrow(() -> new NoSuchElementException("Không tìm thấy nguồn"));
    if (!source.enabled()) throw new IllegalStateException("Bật nguồn trước khi thu thập");
    UUID id = UUID.randomUUID();
    if (!sources.acquire(sourceId, id))
      throw new IllegalStateException(
          "Nguồn đang chờ, đang chạy hoặc trong thời gian nghỉ 60 giây");
    runs.enqueue(id, sourceId);
    return id;
  }

  @Transactional
  public void complete(CrawlRun run, List<FeedItem> items) {
    if (!sources.owns(run.sourceId(), run.id())) return;
    int inserted = 0, rejected = 0;
    for (FeedItem item : items) {
      FeedItem normalized;
      try {
        normalized = policy.normalize(item);
      } catch (IllegalArgumentException e) {
        rejected++;
        continue;
      }
      if (articles.insert(run.sourceId(), normalized, policy.hash(normalized.url()))) inserted++;
    }
    if (!items.isEmpty() && rejected == items.size())
      throw new IllegalArgumentException("Nguồn trả dữ liệu nhưng không có bài hợp lệ");
    runs.finish(
        run.id(),
        "SUCCESS",
        items.size(),
        inserted,
        rejected,
        items.isEmpty() ? "Nguồn chưa có mục nào" : null);
    sources.release(run.sourceId(), run.id(), true, 0);
  }

  @Transactional
  public void fail(CrawlRun run, String message) {
    if (!sources.owns(run.sourceId(), run.id())) return;
    int failures = sources.find(run.sourceId()).orElseThrow().failures();
    runs.finish(run.id(), "FAILED", 0, 0, 0, message);
    sources.release(
        run.sourceId(), run.id(), false, Math.min(360, 15 * (1 << Math.min(failures, 4))));
  }
}
