package vn.financeradar.application;

import jakarta.annotation.PreDestroy;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import vn.financeradar.application.port.*;

@Service
public class KnowledgeIndexer {
  private static final Logger log = LoggerFactory.getLogger(KnowledgeIndexer.class);
  private final VectorRepository vectors;
  private final EmbeddingModel embeddings;
  private final ArticleChunker chunker;
  private volatile long retryAfterMillis;
  private final AtomicBoolean active = new AtomicBoolean();
  private final ExecutorService executor =
      Executors.newSingleThreadExecutor(
          r -> {
            Thread t = new Thread(r, "rag-indexer");
            t.setDaemon(true);
            return t;
          });

  public KnowledgeIndexer(
      VectorRepository vectors, EmbeddingModel embeddings, ArticleChunker chunker) {
    this.vectors = vectors;
    this.embeddings = embeddings;
    this.chunker = chunker;
  }

  @Scheduled(fixedDelay = 15000, initialDelay = 20000)
  public void tick() {
    if (System.currentTimeMillis() < retryAfterMillis
        || !embeddings.configured()
        || !active.compareAndSet(false, true)) return;
    executor.execute(
        () -> {
          try {
            for (int i = 0; i < 5; i++) if (!indexNext()) break;
          } catch (RuntimeException e) {
            log.warn("RAG index pass failed: {}", e.getClass().getSimpleName());
          } finally {
            active.set(false);
          }
        });
  }

  public boolean indexNext() {
    if (!embeddings.configured()) return false;
    var document = vectors.claim(embeddings.modelName(), ArticleChunker.VERSION);
    if (document.isEmpty()) return false;
    var doc = document.get();
    try {
      var chunks = chunker.split(doc.title(), doc.summary());
      vectors.complete(
          doc, embeddings.modelName(), ArticleChunker.VERSION, chunks, embeddings.embed(chunks));
      return true;
    } catch (RuntimeException e) {
      retryAfterMillis = System.currentTimeMillis() + 300000;
      vectors.fail(doc, "Embedding failed; check provider configuration and quota.");
      // End this pass on provider failure; the persisted retry time prevents a tight loop.
      return false;
    }
  }

  @PreDestroy
  public void close() {
    executor.shutdownNow();
  }
}
