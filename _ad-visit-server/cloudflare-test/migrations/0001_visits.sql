CREATE TABLE visits (
  id INTEGER PRIMARY KEY,
  time INTEGER NOT NULL,
  ip TEXT NOT NULL CHECK (ip IN ('192.0.2.10', '198.51.100.20')),
  source TEXT NOT NULL,
  repeated INTEGER NOT NULL CHECK (repeated IN (0, 1))
);
CREATE INDEX visits_time ON visits(time);
CREATE INDEX visits_ip_time ON visits(ip, time);
