CREATE TABLE IF NOT EXISTS ad_visits (
  id INTEGER PRIMARY KEY,
  time INTEGER NOT NULL,
  ip TEXT NOT NULL,
  ad TEXT NOT NULL,
  media TEXT NOT NULL,
  keyword_id TEXT,
  referrer TEXT NOT NULL,
  page TEXT NOT NULL,
  repeated INTEGER NOT NULL CHECK (repeated IN (0, 1))
);
CREATE INDEX IF NOT EXISTS ad_visits_time ON ad_visits(time);
CREATE INDEX IF NOT EXISTS ad_visits_ip_time ON ad_visits(ip, time);
