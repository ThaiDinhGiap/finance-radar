CREATE EXTENSION IF NOT EXISTS unaccent;
ALTER TABLE articles ADD COLUMN knowledge_vector TSVECTOR;
CREATE FUNCTION update_article_knowledge_vector() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.knowledge_vector := setweight(to_tsvector('simple', unaccent(NEW.title)), 'A')
                       || setweight(to_tsvector('simple', unaccent(NEW.summary)), 'B');
  RETURN NEW;
END;
$$;
CREATE TRIGGER article_knowledge_vector BEFORE INSERT OR UPDATE OF title, summary ON articles
FOR EACH ROW EXECUTE FUNCTION update_article_knowledge_vector();
UPDATE articles SET knowledge_vector = setweight(to_tsvector('simple', unaccent(title)), 'A')
                                    || setweight(to_tsvector('simple', unaccent(summary)), 'B');
CREATE INDEX articles_knowledge_search ON articles USING GIN(knowledge_vector);
