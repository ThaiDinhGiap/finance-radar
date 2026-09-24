package vn.financeradar;

import static org.assertj.core.api.Assertions.*;

import java.net.*;
import java.net.http.*;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.env.Environment;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.junit.jupiter.*;
import org.testcontainers.postgresql.PostgreSQLContainer;
import vn.financeradar.application.*;
import vn.financeradar.application.port.*;
import vn.financeradar.domain.*;

@Testcontainers
@SpringBootTest(
    webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
    properties = {
      "radar.scheduler-enabled=false",
      "radar.worker-enabled=false",
      "radar.ai.api-key="
    })
class PipelineIntegrationTest {
  @Container
  static PostgreSQLContainer postgres =
      new PostgreSQLContainer(
          org.testcontainers.utility.DockerImageName.parse("finance-radar-db:local")
              .asCompatibleSubstituteFor("postgres"));

  @DynamicPropertySource
  static void database(DynamicPropertyRegistry r) {
    r.add("spring.datasource.url", postgres::getJdbcUrl);
    r.add("spring.datasource.username", postgres::getUsername);
    r.add("spring.datasource.password", postgres::getPassword);
  }

  @Autowired CatalogService catalog;
  @Autowired CrawlTransactions transactions;
  @Autowired ArticleRepository articles;
  @Autowired RunRepository runs;
  @Autowired JdbcClient db;
  @Autowired Environment environment;
  @Autowired KnowledgeRepository knowledge;
  @Autowired VectorRepository vectors;

  private UUID source() {
    var source =
        catalog.create(
            "Test " + UUID.randomUUID(),
            "https://example.com/" + UUID.randomUUID(),
            Source.Kind.RSS,
            Source.Category.NEWS,
            "vi",
            "VN",
            30,
            null,
            null,
            null,
            null);
    catalog.setEnabled(source.id(), true);
    return source.id();
  }

  private CrawlRun run(UUID source) {
    UUID id = transactions.enqueue(source);
    var run = runs.queued().stream().filter(r -> r.id().equals(id)).findFirst().orElseThrow();
    assertThat(runs.start(id)).isTrue();
    return run;
  }

  @Test
  void pipelineCommitsValidItemsDeduplicatesAndRejectsInvalidItems() {
    UUID source = source();
    var run = run(source);
    String url = "https://example.com/" + UUID.randomUUID();
    transactions.complete(
        run,
        List.of(
            new FeedItem("Kinh tế tăng trưởng", "Nội dung", url + "?utm_source=rss", Instant.now()),
            new FeedItem("Same", "", url, null),
            new FeedItem("Bad", "", "javascript:alert(1)", null)));
    var page = articles.search("tăng trưởng", source, "vi", "NEWS", 0, 20);
    assertThat(page.total()).isEqualTo(1);
    assertThat(page.items().get(0).url()).isEqualTo(url);
    assertThat(catalog.require(source).activeRunId()).isNull();
    var result =
        runs.history(0, 100).items().stream()
            .filter(r -> r.id().equals(run.id()))
            .findFirst()
            .orElseThrow();
    assertThat(result.status()).isEqualTo("SUCCESS");
    assertThat(result.inserted()).isEqualTo(1);
    assertThat(result.rejected()).isEqualTo(1);
  }

  @Test
  void concurrentEnqueueHasOneWinner() throws Exception {
    UUID source = source();
    var executor = Executors.newFixedThreadPool(2);
    try {
      var tasks = List.<Callable<Boolean>>of(() -> enqueue(source), () -> enqueue(source));
      int winners = 0;
      for (var result : executor.invokeAll(tasks)) if (result.get()) winners++;
      assertThat(winners).isEqualTo(1);
    } finally {
      executor.shutdownNow();
    }
  }

  private boolean enqueue(UUID source) {
    try {
      transactions.enqueue(source);
      return true;
    } catch (IllegalStateException e) {
      return false;
    }
  }

  @Test
  void failedRunBacksOffAndStaleCompletionCannotWrite() {
    UUID source = source();
    var run = run(source);
    transactions.fail(run, "upstream unavailable");
    var s = catalog.require(source);
    assertThat(s.failures()).isEqualTo(1);
    assertThat(s.nextRunAt()).isAfter(Instant.now().plusSeconds(800));
    transactions.complete(
        run, List.of(new FeedItem("Stale", "", "https://example.com/stale", null)));
    assertThat(articles.search("", source, "", "", 0, 20).total()).isZero();
  }

  @Test
  void transactionRollbackPreservesNoPartialArticles() {
    UUID source = source();
    var run = run(source);
    assertThatThrownBy(
            () ->
                transactions.complete(
                    run, List.of(new FeedItem("", "", "https://example.com", null))))
        .isInstanceOf(IllegalArgumentException.class);
    assertThat(catalog.require(source).activeRunId()).isEqualTo(run.id());
    assertThat(articles.search("", source, "", "", 0, 20).total()).isZero();
    transactions.fail(run, "No valid items");
  }

  @Test
  void disabledSourceAndEditingActiveSourceAreRejected() {
    UUID source = source();
    catalog.setEnabled(source, false);
    assertThatThrownBy(() -> transactions.enqueue(source))
        .isInstanceOf(IllegalStateException.class);
    catalog.setEnabled(source, true);
    run(source);
    assertThatThrownBy(
            () ->
                catalog.update(
                    source,
                    "New",
                    "https://example.com/new",
                    Source.Kind.RSS,
                    Source.Category.NEWS,
                    "vi",
                    "VN",
                    30,
                    null,
                    null,
                    null,
                    null))
        .isInstanceOf(IllegalStateException.class);
  }

  @Test
  void expiredJobsAreDiscoverable() {
    var run = run(source());
    db.sql("UPDATE crawl_runs SET started_at=now()-interval '11 minutes' WHERE id=:id")
        .param("id", run.id())
        .update();
    assertThat(runs.expired()).extracting(CrawlRun::id).contains(run.id());
  }

  @Test
  void apiAllowsWritesWithoutKeyAndValidatesRequests() throws Exception {
    var client = HttpClient.newHttpClient();
    String base = "http://localhost:" + environment.getProperty("local.server.port") + "/api";
    assertThat(
            client
                .send(
                    HttpRequest.newBuilder(URI.create(base + "/sources")).GET().build(),
                    HttpResponse.BodyHandlers.ofString())
                .statusCode())
        .isEqualTo(200);
    var invalid =
        HttpRequest.newBuilder(URI.create(base + "/sources"))
            .header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString("{}"))
            .build();
    assertThat(client.send(invalid, HttpResponse.BodyHandlers.ofString()).statusCode())
        .isEqualTo(400);
    assertThat(
            client
                .send(
                    HttpRequest.newBuilder(URI.create(base + "/articles?size=1000")).GET().build(),
                    HttpResponse.BodyHandlers.ofString())
                .statusCode())
        .isEqualTo(400);
  }

  @Test
  void partialInsertRollsBackWhenConnectorReturnsMalformedBatch() {
    UUID source = source();
    var run = run(source);
    var items =
        Arrays.asList(
            new FeedItem("Valid", "", "https://example.com/" + UUID.randomUUID(), null), null);
    assertThatThrownBy(() -> transactions.complete(run, items))
        .isInstanceOf(NullPointerException.class);
    assertThat(articles.search("", source, "", "", 0, 20).total()).isZero();
    assertThat(catalog.require(source).activeRunId()).isEqualTo(run.id());
    transactions.fail(run, "Malformed connector batch");
  }

  @Test
  void authenticatedApiCreatesUpdatesEnablesAndQueuesSource() throws Exception {
    String base =
        "http://localhost:" + environment.getProperty("local.server.port") + "/api/sources";
    String body =
        "{\"name\":\"API fixture\",\"url\":\"https://example.com/"
            + UUID.randomUUID()
            + "\",\"kind\":\"RSS\",\"category\":\"NEWS\",\"language\":\"vi\",\"region\":\"VN\",\"intervalMinutes\":30}";
    var created = sendJson("POST", base, body);
    assertThat(created.statusCode()).isEqualTo(201);
    var mapper = new tools.jackson.databind.ObjectMapper();
    var json = mapper.readTree(created.body());
    String id = json.path("id").asText();
    assertThat(json.path("enabled").asBoolean()).isFalse();
    assertThat(sendJson("POST", base, body).statusCode()).isEqualTo(409);
    assertThat(
            sendJson("PUT", base + "/" + id, body.replace("API fixture", "API edited"))
                .statusCode())
        .isEqualTo(200);
    assertThat(sendJson("PATCH", base + "/" + id, "{\"enabled\":true}").statusCode())
        .isEqualTo(204);
    assertThat(sendJson("POST", base + "/" + id + "/crawl", "{}").statusCode()).isEqualTo(202);
    assertThat(sendJson("POST", base + "/" + id + "/crawl", "{}").statusCode()).isEqualTo(409);
  }

  private HttpResponse<String> sendJson(String method, String url, String body) throws Exception {
    return HttpClient.newHttpClient()
        .send(
            HttpRequest.newBuilder(URI.create(url))
                .header("Content-Type", "application/json")
                .method(method, HttpRequest.BodyPublishers.ofString(body))
                .build(),
            HttpResponse.BodyHandlers.ofString());
  }

  private float[] vector(int axis) {
    float[] v = new float[1536];
    v[axis] = 1;
    return v;
  }

  private void indexAll() {
    for (int i = 0; i < 200; i++) {
      var next = vectors.claim("test-embedding", 1);
      if (next.isEmpty()) return;
      var doc = next.get();
      vectors.complete(
          doc,
          "test-embedding",
          1,
          List.of(doc.title() + "\n" + doc.summary()),
          List.of(vector(0)));
    }
    throw new AssertionError("Unexpected index backlog");
  }

  @Test
  void vectorRetrievalUsesCosineFiltersAndRejectsStaleOrSocialContent() {
    UUID news = source();
    String id = UUID.randomUUID().toString();
    articles.insert(
        news,
        new FeedItem(
            "No shared query keyword",
            "Source evidence",
            "https://example.com/" + id,
            Instant.now()),
        id);
    indexAll();
    var scope = new KnowledgeScope(news, "vi", 30);
    var found = vectors.search(vector(0), "test-embedding", 1, scope, 8, 0.5);
    assertThat(found).hasSize(1);
    assertThat(found.get(0).similarity()).isCloseTo(1.0, within(0.0001));
    assertThat(vectors.search(vector(1), "test-embedding", 1, scope, 8, 0.5)).isEmpty();
    assertThat(vectors.search(vector(0), "different-model", 1, scope, 8, 0.5)).isEmpty();
    assertThat(vectors.search(vector(0), "test-embedding", 2, scope, 8, 0.5)).isEmpty();
    assertThat(
            vectors.search(
                vector(0), "test-embedding", 1, new KnowledgeScope(news, "en", 30), 8, 0.5))
        .isEmpty();
    db.sql("UPDATE sources SET category='SOCIAL' WHERE id=:id").param("id", news).update();
    assertThat(vectors.search(vector(0), "test-embedding", 1, scope, 8, 0.5)).isEmpty();
    db.sql("UPDATE sources SET category='NEWS' WHERE id=:id").param("id", news).update();
    db.sql("UPDATE articles SET summary='Updated content' WHERE source_id=:id")
        .param("id", news)
        .update();
    assertThat(vectors.search(vector(0), "test-embedding", 1, scope, 8, 0.5)).isEmpty();
    indexAll();
    assertThat(vectors.search(vector(0), "test-embedding", 1, scope, 8, 0.5)).hasSize(1);
    db.sql("UPDATE articles SET published_at=now()-interval '40 days' WHERE source_id=:id")
        .param("id", news)
        .update();
    assertThat(vectors.search(vector(0), "test-embedding", 1, scope, 8, 0.5)).isEmpty();
  }

  @Test
  void indexLeaseIsFencedAndChunkReplacementRollsBackOnFailure() {
    indexAll();
    UUID news = source();
    String id = UUID.randomUUID().toString();
    articles.insert(
        news,
        new FeedItem("Index transaction", "Source", "https://example.com/" + id, Instant.now()),
        id);
    var old = vectors.claim("test-embedding", 1).orElseThrow();
    assertThat(vectors.claim("test-embedding", 1)).isEmpty();
    db.sql("UPDATE rag_documents SET retry_at=now()-interval '1 second' WHERE article_id=:id")
        .param("id", old.articleId())
        .update();
    var fresh = vectors.claim("test-embedding", 1).orElseThrow();
    assertThat(vectors.complete(old, "test-embedding", 1, List.of("old"), List.of(vector(0))))
        .isFalse();
    assertThatThrownBy(
            () ->
                vectors.complete(
                    fresh,
                    "test-embedding",
                    1,
                    List.of("one", "two"),
                    List.of(vector(0), new float[2])))
        .isInstanceOf(IllegalArgumentException.class);
    assertThat(
            db.sql("SELECT count(*) FROM rag_chunks WHERE article_id=:id")
                .param("id", fresh.articleId())
                .query(Long.class)
                .single())
        .isZero();
    assertThat(vectors.complete(fresh, "test-embedding", 1, List.of("fresh"), List.of(vector(0))))
        .isTrue();
    assertThat(vectors.snapshot("test-embedding", 1).ready()).isPositive();
  }

  @Test
  void chatEndpointsHandleEmptyEvidenceMissingKeyAndInputLimits() throws Exception {
    String base = "http://localhost:" + environment.getProperty("local.server.port") + "/api/chat";
    UUID source = source();
    String suffix = UUID.randomUUID().toString();
    articles.insert(
        source,
        new FeedItem(
            "Raguniquetopic tin mới",
            "Dữ liệu chỉ từ báo",
            "https://example.com/" + suffix,
            Instant.now()),
        suffix);
    String body =
        "{\"question\":\"raguniquetopic\",\"previousQuestions\":[],\"sourceId\":\""
            + source
            + "\",\"language\":\"vi\",\"days\":30}";
    var retrieval = sendJson("POST", base + "/retrieve", body);
    assertThat(retrieval.statusCode()).isEqualTo(503);
    assertThat(sendJson("POST", base + "/answer", body).statusCode()).isEqualTo(503);
    var absent =
        sendJson("POST", base + "/answer", body.replace("raguniquetopic", "neverfoundword"));
    assertThat(absent.statusCode()).isEqualTo(503);
    assertThat(
            sendJson("POST", base + "/answer", body.replace("raguniquetopic", "x".repeat(1501)))
                .statusCode())
        .isEqualTo(400);
    var noKey =
        HttpRequest.newBuilder(URI.create(base + "/answer"))
            .header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString(body))
            .build();
    assertThat(
            HttpClient.newHttpClient()
                .send(noKey, HttpResponse.BodyHandlers.ofString())
                .statusCode())
        .isEqualTo(503);
  }
}
