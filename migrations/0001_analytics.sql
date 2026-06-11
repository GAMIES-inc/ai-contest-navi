CREATE TABLE IF NOT EXISTS page_views (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  path TEXT NOT NULL,
  page_type TEXT NOT NULL,
  page_id TEXT,
  title TEXT,
  referrer_host TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_content TEXT,
  utm_term TEXT,
  country TEXT,
  is_bot INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_page_views_created_at ON page_views(created_at);
CREATE INDEX IF NOT EXISTS idx_page_views_path ON page_views(path);
CREATE INDEX IF NOT EXISTS idx_page_views_page_type ON page_views(page_type);
CREATE INDEX IF NOT EXISTS idx_page_views_page_id ON page_views(page_id);
CREATE INDEX IF NOT EXISTS idx_page_views_utm_campaign ON page_views(utm_campaign);

CREATE TABLE IF NOT EXISTS outbound_clicks (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  contest_slug TEXT NOT NULL,
  contest_title TEXT,
  link_key TEXT NOT NULL,
  destination_url TEXT NOT NULL,
  destination_domain TEXT,
  source_path TEXT,
  source_page_type TEXT,
  source_page_id TEXT,
  referrer_host TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_content TEXT,
  utm_term TEXT,
  country TEXT,
  is_bot INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_outbound_clicks_created_at ON outbound_clicks(created_at);
CREATE INDEX IF NOT EXISTS idx_outbound_clicks_contest_slug ON outbound_clicks(contest_slug);
CREATE INDEX IF NOT EXISTS idx_outbound_clicks_link_key ON outbound_clicks(link_key);
CREATE INDEX IF NOT EXISTS idx_outbound_clicks_utm_campaign ON outbound_clicks(utm_campaign);
