package vn.financeradar.application;

import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import vn.financeradar.application.port.*;
import vn.financeradar.domain.*;

@Component
@org.springframework.boot.autoconfigure.condition.ConditionalOnProperty(
    name = "radar.worker-enabled",
    havingValue = "true",
    matchIfMissing = true)
public class CrawlWorker {
  private static final Logger log = LoggerFactory.getLogger(CrawlWorker.class);
  private final SourceRepository sources;
  private final RunRepository runs;
  private final CrawlTransactions transactions;
  private final Map<Source.Kind, FeedConnector> connectors;
  private final boolean schedulerEnabled;

  public CrawlWorker(
      SourceRepository sources,
      RunRepository runs,
      CrawlTransactions transactions,
      List<FeedConnector> connectors,
      @Value("${radar.scheduler-enabled}") boolean schedulerEnabled) {
    this.sources = sources;
    this.runs = runs;
    this.transactions = transactions;
    this.connectors =
        connectors.stream()
            .collect(Collectors.toUnmodifiableMap(FeedConnector::kind, Function.identity()));
    this.schedulerEnabled = schedulerEnabled;
  }

  @Scheduled(fixedDelay = 30000, initialDelay = 15000)
  public void schedule() {
    for (CrawlRun run : runs.expired())
      transactions.fail(run, "Hết thời gian xử lý; sẽ thử lại theo lịch");
    if (schedulerEnabled)
      for (UUID id : sources.dueSources()) {
        try {
          transactions.enqueue(id);
        } catch (IllegalStateException ignored) {
          /* Another worker acquired the source. */
        }
      }
  }

  @Scheduled(fixedDelay = 2000, initialDelay = 3000)
  public void process() {
    for (CrawlRun run : runs.queued()) {
      if (!runs.start(run.id())) continue;
      try {
        Source source = sources.find(run.sourceId()).orElseThrow();
        if (!source.enabled()) throw new IllegalStateException("Nguồn đã tạm dừng");
        transactions.complete(run, connectors.get(source.kind()).fetch(source));
      } catch (Exception e) {
        log.warn(
            "Crawl failed: source={} run={} type={}",
            run.sourceId(),
            run.id(),
            e.getClass().getSimpleName());
        String message = e.getMessage() == null ? "Không thể xử lý nguồn" : e.getMessage();
        transactions.fail(run, message.substring(0, Math.min(900, message.length())));
      }
    }
  }
}
