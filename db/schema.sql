CREATE TABLE IF NOT EXISTS player
(
  id INTEGER PRIMARY KEY,
  gold REAL NOT NULL DEFAULT 0,
  production_rate REAL NOT NULL DEFAULT 1,
  last_updated INTEGER NOT NULL DEFAULT 0
);

INSERT OR IGNORE INTO player (id, gold, production_rate, last_updated) VALUES (1, 0, 1, 0);