CREATE TABLE sources (
 id UUID PRIMARY KEY, name VARCHAR(120) NOT NULL, url VARCHAR(2048) NOT NULL UNIQUE,
 kind VARCHAR(20) NOT NULL CHECK (kind IN ('RSS','HTML','MASTODON')),
 category VARCHAR(20) NOT NULL CHECK (category IN ('NEWS','INSTITUTION','FORUM','SOCIAL')),
 language VARCHAR(8) NOT NULL, region VARCHAR(20) NOT NULL,
 enabled BOOLEAN NOT NULL DEFAULT FALSE, interval_minutes INTEGER NOT NULL CHECK(interval_minutes BETWEEN 15 AND 10080),
 item_selector VARCHAR(300), title_selector VARCHAR(300), link_selector VARCHAR(300), summary_selector VARCHAR(300),
 active_run_id UUID, next_run_at TIMESTAMPTZ NOT NULL DEFAULT now(), last_success_at TIMESTAMPTZ,
 failures INTEGER NOT NULL DEFAULT 0, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE crawl_runs (
 id UUID PRIMARY KEY, source_id UUID NOT NULL REFERENCES sources(id),
 status VARCHAR(20) NOT NULL CHECK(status IN ('QUEUED','RUNNING','SUCCESS','FAILED')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(), started_at TIMESTAMPTZ, finished_at TIMESTAMPTZ,
 fetched INTEGER NOT NULL DEFAULT 0, inserted INTEGER NOT NULL DEFAULT 0, rejected INTEGER NOT NULL DEFAULT 0,
 message VARCHAR(1000)
);
CREATE INDEX runs_status_created ON crawl_runs(status,created_at);
CREATE TABLE articles (
 id UUID PRIMARY KEY, source_id UUID NOT NULL REFERENCES sources(id), title VARCHAR(500) NOT NULL,
 summary VARCHAR(1500) NOT NULL, url VARCHAR(2048) NOT NULL,
 url_hash CHAR(64) NOT NULL UNIQUE, published_at TIMESTAMPTZ, collected_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX articles_collected ON articles(collected_at DESC,id);
CREATE INDEX articles_source ON articles(source_id);
CREATE INDEX articles_search ON articles USING GIN(to_tsvector('simple', title || ' ' || summary));
INSERT INTO sources(id,name,url,kind,category,language,region,enabled,interval_minutes) VALUES
 ('10000000-0000-0000-0000-000000000001','VnExpress · Kinh doanh','https://vnexpress.net/rss/kinh-doanh.rss','RSS','NEWS','vi','VN',true,30),
 ('10000000-0000-0000-0000-000000000002','Tuổi Trẻ · Kinh doanh','https://tuoitre.vn/rss/kinh-doanh.rss','RSS','NEWS','vi','VN',true,30),
 ('10000000-0000-0000-0000-000000000003','BBC · Business','https://feeds.bbci.co.uk/news/business/rss.xml','RSS','NEWS','en','GLOBAL',true,30),
 ('10000000-0000-0000-0000-000000000004','Federal Reserve','https://www.federalreserve.gov/feeds/press_all.xml','RSS','INSTITUTION','en','US',true,60),
 ('10000000-0000-0000-0000-000000000005','ECB · Press releases','https://www.ecb.europa.eu/rss/press.html','RSS','INSTITUTION','en','EU',true,60),
 ('10000000-0000-0000-0000-000000000006','Reddit · Economics (RSS)','https://www.reddit.com/r/Economics/.rss','RSS','FORUM','en','GLOBAL',false,60),
 ('10000000-0000-0000-0000-000000000007','Mastodon · Economics','https://mastodon.social/api/v1/timelines/tag/economics?limit=20','MASTODON','SOCIAL','en','GLOBAL',false,60);
