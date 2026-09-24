package vn.financeradar.web;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import vn.financeradar.application.*;
import vn.financeradar.application.port.*;
import vn.financeradar.domain.*;

@RestController
@RequestMapping("/api")
@Validated
public class ApiController {
  private final CatalogService catalog;
  private final CrawlTransactions crawls;
  private final ArticleRepository articles;
  private final RunRepository runs;

  public ApiController(
      CatalogService catalog,
      CrawlTransactions crawls,
      ArticleRepository articles,
      RunRepository runs) {
    this.catalog = catalog;
    this.crawls = crawls;
    this.articles = articles;
    this.runs = runs;
  }

  @GetMapping("/sources")
  public List<Source> sources() {
    return catalog.list();
  }

  @PostMapping("/sources")
  @ResponseStatus(HttpStatus.CREATED)
  public Source create(@Valid @RequestBody SourceRequest r) {
    return catalog.create(
        r.name(),
        r.url(),
        r.kind(),
        r.category(),
        r.language(),
        r.region(),
        r.intervalMinutes(),
        r.itemSelector(),
        r.titleSelector(),
        r.linkSelector(),
        r.summarySelector());
  }

  @PutMapping("/sources/{id}")
  public Source update(@PathVariable UUID id, @Valid @RequestBody SourceRequest r) {
    return catalog.update(
        id,
        r.name(),
        r.url(),
        r.kind(),
        r.category(),
        r.language(),
        r.region(),
        r.intervalMinutes(),
        r.itemSelector(),
        r.titleSelector(),
        r.linkSelector(),
        r.summarySelector());
  }

  public record EnabledRequest(@NotNull Boolean enabled) {}

  @PatchMapping("/sources/{id}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void enabled(@PathVariable UUID id, @Valid @RequestBody EnabledRequest r) {
    catalog.setEnabled(id, r.enabled());
  }

  @PostMapping("/sources/{id}/crawl")
  @ResponseStatus(HttpStatus.ACCEPTED)
  public Map<String, UUID> crawl(@PathVariable UUID id) {
    return Map.of("runId", crawls.enqueue(id));
  }

  @GetMapping("/articles")
  public Page<Article> articles(
      @RequestParam(defaultValue = "") @Size(max = 200) String q,
      @RequestParam(required = false) UUID sourceId,
      @RequestParam(defaultValue = "") @Pattern(regexp = "|vi|en|other") String language,
      @RequestParam(defaultValue = "") @Pattern(regexp = "|NEWS|INSTITUTION|FORUM|SOCIAL")
          String category,
      @RequestParam(defaultValue = "0") @Min(0) @Max(100000) int page,
      @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size) {
    return articles.search(q, sourceId, language, category, page, size);
  }

  @GetMapping("/runs")
  public Page<CrawlRun> runs(
      @RequestParam(defaultValue = "0") @Min(0) @Max(100000) int page,
      @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size) {
    return runs.history(page, size);
  }

  @GetMapping("/stats")
  public Map<String, Object> stats() {
    List<Source> sources = catalog.list();
    Map<String, Object> result = new LinkedHashMap<>();
    result.put("articles", articles.count());
    result.put("sources", sources.size());
    result.put("enabledSources", sources.stream().filter(Source::enabled).count());
    result.put("runningSources", sources.stream().filter(s -> s.activeRunId() != null).count());
    result.put("failingSources", sources.stream().filter(s -> s.failures() > 0).count());
    return result;
  }
}
