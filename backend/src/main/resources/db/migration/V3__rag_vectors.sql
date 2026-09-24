CREATE EXTENSION IF NOT EXISTS vector;
CREATE TABLE rag_documents (
 article_id uuid PRIMARY KEY REFERENCES articles(id) ON DELETE CASCADE,
 fingerprint text NOT NULL, model text NOT NULL, version integer NOT NULL,
 status text NOT NULL CHECK(status IN ('INDEXING','READY','FAILED')),
 lease uuid NOT NULL, retry_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(), last_error text
);
CREATE TABLE rag_chunks (
 id uuid PRIMARY KEY, article_id uuid NOT NULL REFERENCES rag_documents(article_id) ON DELETE CASCADE,
 position integer NOT NULL, content text NOT NULL, embedding vector(1536) NOT NULL,
 UNIQUE(article_id,position)
);
-- Exact cosine search preserves filtered recall for the current small corpus.
-- Add an ANN index only after measuring volume and filtered recall.
