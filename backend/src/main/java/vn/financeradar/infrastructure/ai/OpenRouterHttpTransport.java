package vn.financeradar.infrastructure.ai;

import jakarta.annotation.PreDestroy;
import java.io.*;
import java.net.*;
import java.util.concurrent.*;
import org.apache.hc.client5.http.DnsResolver;
import org.apache.hc.client5.http.classic.methods.HttpPost;
import org.apache.hc.client5.http.config.RequestConfig;
import org.apache.hc.client5.http.impl.classic.*;
import org.apache.hc.client5.http.impl.io.PoolingHttpClientConnectionManagerBuilder;
import org.apache.hc.core5.http.ContentType;
import org.apache.hc.core5.http.io.entity.ByteArrayEntity;
import org.apache.hc.core5.util.Timeout;
import org.springframework.stereotype.Component;
import vn.financeradar.application.ChatFailure;
import vn.financeradar.infrastructure.crawl.PublicUrlPolicy;

@Component
public class OpenRouterHttpTransport {
  private static final URI ENDPOINT = URI.create("https://openrouter.ai/api/v1/chat/completions");
  private static final URI EMBEDDINGS = URI.create("https://openrouter.ai/api/v1/embeddings");
  private static final int MAX_RESPONSE_BYTES = 512 * 1024;
  private final CloseableHttpClient client;
  private final ScheduledExecutorService deadlines =
      Executors.newSingleThreadScheduledExecutor(
          task -> {
            Thread thread = new Thread(task, "ai-http-deadline");
            thread.setDaemon(true);
            return thread;
          });

  public OpenRouterHttpTransport(PublicUrlPolicy urls) {
    DnsResolver dns =
        new DnsResolver() {
          public InetAddress[] resolve(String host) throws UnknownHostException {
            return urls.resolve(host);
          }

          public String resolveCanonicalHostname(String host) throws UnknownHostException {
            urls.resolve(host);
            return host;
          }
        };
    client =
        HttpClients.custom()
            .setConnectionManager(
                PoolingHttpClientConnectionManagerBuilder.create().setDnsResolver(dns).build())
            .disableAutomaticRetries()
            .disableRedirectHandling()
            .disableCookieManagement()
            .setDefaultRequestConfig(
                RequestConfig.custom()
                    .setConnectTimeout(Timeout.ofSeconds(8))
                    .setConnectionRequestTimeout(Timeout.ofSeconds(5))
                    .setResponseTimeout(Timeout.ofSeconds(45))
                    .build())
            .build();
  }

  public byte[] execute(byte[] payload, String key) {
    return post(ENDPOINT, payload, key);
  }

  public byte[] embeddings(byte[] payload, String key) {
    return post(EMBEDDINGS, payload, key);
  }

  private byte[] post(URI endpoint, byte[] payload, String key) {
    HttpPost request = new HttpPost(endpoint);
    request.setHeader("Authorization", "Bearer " + key);
    request.setHeader("Accept", "application/json");
    request.setEntity(new ByteArrayEntity(payload, ContentType.APPLICATION_JSON));
    ScheduledFuture<?> deadline = deadlines.schedule(request::cancel, 60, TimeUnit.SECONDS);
    try {
      return client.execute(
          request,
          response -> {
            if (response.getCode() != 200) {
              String message =
                  switch (response.getCode()) {
                    case 401, 403 ->
                        "OpenRouter từ chối xác thực/quyền truy cập. Kiểm tra API key và quyền model trên máy chủ.";
                    case 402 ->
                        "OpenRouter không đủ credits cho yêu cầu này. Kiểm tra số dư tài khoản, bao gồm chi phí embedding.";
                    case 429 ->
                        "OpenRouter đang giới hạn lượt gọi hoặc tài khoản hết hạn mức. Kiểm tra quota và thử lại sau.";
                    default ->
                        "OpenRouter không hoàn tất yêu cầu. Kiểm tra cấu hình model hoặc thử lại sau.";
                  };
              throw new ChatFailure(ChatFailure.Reason.UPSTREAM, message);
            }
            if (response.getEntity() == null) throw new IOException("Empty response");
            try (InputStream input = response.getEntity().getContent()) {
              byte[] bytes = input.readNBytes(MAX_RESPONSE_BYTES + 1);
              if (bytes.length > MAX_RESPONSE_BYTES) throw new IOException("Response too large");
              return bytes;
            }
          });
    } catch (ChatFailure e) {
      throw e;
    } catch (IOException e) {
      throw new ChatFailure(
          ChatFailure.Reason.UPSTREAM,
          "Không kết nối được OpenRouter hoặc yêu cầu quá thời gian. Chưa có câu trả lời được tạo.");
    } finally {
      deadline.cancel(false);
    }
  }

  @PreDestroy
  public void close() throws IOException {
    deadlines.shutdownNow();
    client.close();
  }
}
