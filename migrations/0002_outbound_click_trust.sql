ALTER TABLE outbound_clicks ADD COLUMN click_trust TEXT;
ALTER TABLE outbound_clicks ADD COLUMN click_source_kind TEXT;
ALTER TABLE outbound_clicks ADD COLUMN click_trust_reasons TEXT;

CREATE INDEX IF NOT EXISTS idx_outbound_clicks_click_trust ON outbound_clicks(click_trust);
