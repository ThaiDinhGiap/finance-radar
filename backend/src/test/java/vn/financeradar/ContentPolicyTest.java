package vn.financeradar;

import static org.assertj.core.api.Assertions.*;

import java.net.InetAddress;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import org.junit.jupiter.api.Test;
import vn.financeradar.domain.FeedItem;
import vn.financeradar.infrastructure.crawl.*;

class ContentPolicyTest {
  private final PublicUrlPolicy urls = new PublicUrlPolicy();
  private final TextContentPolicy policy = new TextContentPolicy(urls);

  @Test
  void removesTrackingWithoutRemovingIdentityQuery() {
    assertThat(policy.canonical("https://EXAMPLE.com/news?id=42&utm_source=rss&fbclid=x#fragment"))
        .isEqualTo("https://example.com/news?id=42");
    assertThat(policy.hash(policy.canonical("https://example.com/news?id=42&utm_medium=rss")))
        .isEqualTo(policy.hash("https://example.com/news?id=42"));
  }

  @Test
  void sanitizesMarkupAndBoundsText() {
    var item =
        policy.normalize(
            new FeedItem(
                "<b>News</b>",
                "<script>alert(1)</script><p>Economy</p>",
                "https://example.com/a",
                Instant.now().plusSeconds(172800)));
    assertThat(item.title()).isEqualTo("News");
    assertThat(item.summary()).isEqualTo("Economy");
    assertThat(item.publishedAt()).isNull();
    assertThat(
            policy
                .normalize(
                    new FeedItem("x".repeat(600), "y".repeat(2000), "https://example.com", null))
                .summary())
        .hasSize(1500);
  }

  @Test
  void rejectsUnsafeSchemesAndCredentials() {
    for (String url :
        new String[] {
          "file:///etc/passwd",
          "http://example.com",
          "https://user:pass@example.com",
          "https://example.com:8080/x",
          "javascript:alert(1)"
        })
      assertThatThrownBy(() -> urls.validate(url)).isInstanceOf(IllegalArgumentException.class);
  }

  @Test
  void blocksPrivateMetadataAndReservedAddresses() throws Exception {
    for (String ip :
        new String[] {
          "127.0.0.1",
          "0.0.0.0",
          "10.0.0.1",
          "172.16.0.1",
          "192.168.0.1",
          "169.254.169.254",
          "100.100.100.200",
          "::1",
          "fc00::1",
          "fe80::1",
          "2001:db8::1",
          "::ffff:127.0.0.1"
        }) assertThat(urls.isPublic(InetAddress.getByName(ip))).as(ip).isFalse();
    assertThat(urls.isPublic(InetAddress.getByName("8.8.8.8"))).isTrue();
    assertThatThrownBy(() -> urls.resolve("localhost"))
        .isInstanceOf(java.net.UnknownHostException.class);
  }

  @Test
  void parsesRssAndAtom() throws Exception {
    var connector = new RssConnector(null);
    var rss =
        "<rss version='2.0'><channel><title>News</title><link>https://example.com</link><description>News</description><item><title>GDP</title><link>https://example.com/a</link><description>Growth</description></item></channel></rss>";
    assertThat(connector.parse(rss.getBytes(StandardCharsets.UTF_8)))
        .singleElement()
        .satisfies(i -> assertThat(i.title()).isEqualTo("GDP"));
    var atom =
        "<feed xmlns='http://www.w3.org/2005/Atom'><title>News</title><id>https://example.com</id><updated>2026-09-20T00:00:00Z</updated><entry><title>Inflation</title><id>1</id><link href='https://example.com/b'/><updated>2026-09-20T00:00:00Z</updated><summary>Prices</summary></entry></feed>";
    assertThat(connector.parse(atom.getBytes(StandardCharsets.UTF_8)))
        .singleElement()
        .satisfies(i -> assertThat(i.url()).isEqualTo("https://example.com/b"));
  }

  @Test
  void rejectsXmlDoctype() {
    var xml =
        "<!DOCTYPE rss [<!ENTITY xxe SYSTEM 'file:///etc/passwd'>]><rss version='2.0'><channel><title>&xxe;</title></channel></rss>";
    assertThatThrownBy(() -> new RssConnector(null).parse(xml.getBytes(StandardCharsets.UTF_8)))
        .isInstanceOf(Exception.class);
  }

  @Test
  void rejectsInvalidSelectorsAndEmptyTitles() {
    assertThatThrownBy(() -> policy.validateSelector("[broken"))
        .isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> policy.normalize(new FeedItem("", "", "https://example.com", null)))
        .isInstanceOf(IllegalArgumentException.class);
  }

  @Test
  void htmlAdapterExtractsRelativeLinksAndDetectsBrokenSelectors() throws Exception {
    var source =
        new vn.financeradar.domain.Source(
            java.util.UUID.randomUUID(),
            "HTML",
            "https://example.com/news/",
            vn.financeradar.domain.Source.Kind.HTML,
            vn.financeradar.domain.Source.Category.NEWS,
            "en",
            "GLOBAL",
            true,
            30,
            "article",
            "h2",
            "a",
            ".summary",
            null,
            Instant.now(),
            null,
            0);
    var connector = new HtmlConnector(null);
    var bytes =
        "<article><h2>Markets</h2><a href='/story'>Read</a><p class='summary'>Growth</p></article>"
            .getBytes(StandardCharsets.UTF_8);
    assertThat(connector.parse(bytes, source))
        .singleElement()
        .satisfies(
            item -> {
              assertThat(item.url()).isEqualTo("https://example.com/story");
              assertThat(item.summary()).isEqualTo("Growth");
            });
    assertThatThrownBy(
            () ->
                connector.parse(
                    "<main>Changed layout</main>".getBytes(StandardCharsets.UTF_8), source))
        .isInstanceOf(java.io.IOException.class);
  }

  @Test
  void mastodonAdapterParsesPublicStatusesAndRejectsErrorObject() {
    var connector = new MastodonConnector(null, new tools.jackson.databind.ObjectMapper());
    var bytes =
        "[{\"content\":\"<p>Economics</p>\",\"url\":\"https://example.com/@user/1\",\"created_at\":\"2026-09-20T00:00:00Z\"}]"
            .getBytes(StandardCharsets.UTF_8);
    assertThat(connector.parse(bytes))
        .singleElement()
        .satisfies(
            item -> {
              assertThat(item.title()).isEqualTo("Economics");
              assertThat(item.publishedAt()).isEqualTo(Instant.parse("2026-09-20T00:00:00Z"));
            });
    assertThatThrownBy(
            () -> connector.parse("{\"error\":\"Unauthorized\"}".getBytes(StandardCharsets.UTF_8)))
        .isInstanceOf(IllegalArgumentException.class);
  }

  @Test
  void preservesEmbeddedUrlPathsAndRepeatedQueryOrder() {
    String url = "https://fed.brid.gy/r/https://bsky.app/profile/example/post/123?tag=z&tag=a";
    assertThat(policy.canonical(url + "&utm_source=feed#fragment")).isEqualTo(url);
  }
}
