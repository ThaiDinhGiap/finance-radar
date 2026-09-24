package vn.financeradar.infrastructure.crawl;

import crawlercommons.robots.SimpleRobotRulesParser;
import jakarta.annotation.PreDestroy;
import java.io.*;
import java.net.*;
import java.util.*;
import org.apache.hc.client5.http.DnsResolver;
import org.apache.hc.client5.http.classic.methods.HttpGet;
import org.apache.hc.client5.http.config.RequestConfig;
import org.apache.hc.client5.http.impl.classic.CloseableHttpClient;
import org.apache.hc.client5.http.impl.classic.HttpClients;
import org.apache.hc.client5.http.impl.io.PoolingHttpClientConnectionManagerBuilder;
import org.apache.hc.core5.util.Timeout;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class SafeHttpFetcher {
  private static final int MAX_BYTES = 2 * 1024 * 1024;
  private final PublicUrlPolicy urls;
  private final CloseableHttpClient client;
  private final String userAgent;
  private final Map<String, Long> lastRequest = new HashMap<>();

  public SafeHttpFetcher(PublicUrlPolicy urls, @Value("${radar.user-agent}") String userAgent) {
    this.urls = urls;
    this.userAgent = userAgent;
    DnsResolver resolver =
        new DnsResolver() {
          public InetAddress[] resolve(String host) throws UnknownHostException {
            return urls.resolve(host);
          }

          public String resolveCanonicalHostname(String host) throws UnknownHostException {
            urls.resolve(host);
            return host;
          }
        };
    var manager =
        PoolingHttpClientConnectionManagerBuilder.create().setDnsResolver(resolver).build();
    client =
        HttpClients.custom()
            .setConnectionManager(manager)
            .disableRedirectHandling()
            .disableAutomaticRetries()
            .disableCookieManagement()
            .setUserAgent(userAgent)
            .setDefaultRequestConfig(
                RequestConfig.custom()
                    .setConnectTimeout(Timeout.ofSeconds(8))
                    .setConnectionRequestTimeout(Timeout.ofSeconds(5))
                    .setResponseTimeout(Timeout.ofSeconds(20))
                    .build())
            .build();
  }

  public byte[] fetch(String url) throws Exception {
    URI uri = urls.validate(url);
    checkRobots(uri);
    Response response = get(uri);
    if (response.status() != 200)
      throw new IOException("Nguồn trả HTTP " + response.status() + "; không vượt chặn truy cập");
    return response.body();
  }

  private void checkRobots(URI uri) throws Exception {
    URI robots = URI.create("https://" + uri.getRawAuthority() + "/robots.txt");
    Response response = get(robots);
    if (response.status() == 404 || response.status() == 410) return;
    if (response.status() != 200)
      throw new IOException("Không xác minh được robots.txt (HTTP " + response.status() + ")");
    var rules =
        new SimpleRobotRulesParser()
            .parseContent(robots.toString(), response.body(), "text/plain", userAgent);
    if (!rules.isAllowed(uri.toString()))
      throw new IOException("robots.txt không cho phép thu thập đường dẫn này");
    if (rules.getCrawlDelay() > 30000)
      throw new IOException("Nguồn yêu cầu crawl-delay > 30 giây; cần cấu hình worker riêng");
    pause(uri.getHost(), Math.max(2000, rules.getCrawlDelay()));
  }

  private synchronized void pause(String host, long delay) throws InterruptedException {
    long wait = lastRequest.getOrDefault(host, 0L) + delay - System.currentTimeMillis();
    if (wait > 0) Thread.sleep(wait);
    if (lastRequest.size() > 1000) lastRequest.clear();
    lastRequest.put(host, System.currentTimeMillis());
  }

  private Response get(URI initial) throws Exception {
    URI uri = initial;
    long deadline = System.nanoTime() + java.util.concurrent.TimeUnit.SECONDS.toNanos(60);
    for (int redirects = 0; redirects < 4; redirects++) {
      urls.validate(uri.toString());
      pause(uri.getHost(), 2000);
      HttpGet request = new HttpGet(uri);
      request.setHeader(
          "Accept",
          "application/rss+xml, application/atom+xml, application/xml, text/html, application/json, text/plain;q=0.9, */*;q=0.5");
      Response response =
          client.execute(
              request,
              r -> {
                int status = r.getCode();
                String location =
                    r.getFirstHeader("Location") == null
                        ? null
                        : r.getFirstHeader("Location").getValue();
                if (status >= 300 && status < 400)
                  return new Response(status, new byte[0], location);
                if (r.getEntity() == null) return new Response(status, new byte[0], null);
                try (InputStream in = r.getEntity().getContent();
                    ByteArrayOutputStream out = new ByteArrayOutputStream()) {
                  byte[] buffer = new byte[8192];
                  int read;
                  while ((read = in.read(buffer)) != -1) {
                    if (System.nanoTime() > deadline)
                      throw new IOException("Hết thời gian tải nguồn");
                    if (out.size() + read > MAX_BYTES)
                      throw new IOException("Nội dung vượt giới hạn 2 MB");
                    out.write(buffer, 0, read);
                  }
                  return new Response(status, out.toByteArray(), null);
                }
              });
      if (response.status() >= 300 && response.status() < 400 && response.location() != null) {
        URI next = uri.resolve(response.location());
        urls.validate(next.toString());
        // A new host/path needs its own robots evaluation; require an explicit source update
        // instead.
        throw new IOException("Nguồn chuyển hướng; cập nhật URL nguồn thành: " + next);
      }
      return response;
    }
    throw new IOException("Quá nhiều chuyển hướng");
  }

  @PreDestroy
  public void close() throws IOException {
    client.close();
  }

  private record Response(int status, byte[] body, String location) {}
}
