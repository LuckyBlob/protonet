CREATE TABLE IF NOT EXISTS users
(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  admin_level INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions
(
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);

CREATE TABLE IF NOT EXISTS player
(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE,
  gold REAL NOT NULL DEFAULT 100,
  upgrade_level INTEGER NOT NULL DEFAULT 0,
  last_updated INTEGER NOT NULL DEFAULT 0,
  building_upgrade_completes_at INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS server_config
(
  id INTEGER PRIMARY KEY CHECK (id = 1),
  time_multiplier REAL NOT NULL DEFAULT 1
);

INSERT OR IGNORE INTO server_config (id, time_multiplier) VALUES (1, 1);

CREATE TABLE planet
(
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	slot INTEGER NOT NULL,
	system INTEGER NOT NULL,
	galaxy INTEGER NOT NULL,
	size INTEGER NOT NULL,
	owner_player_id INTEGER,
  claimed_at INTEGER NOT NULL DEFAULT 0,
	ressource_1 REAL NOT NULL DEFAULT 0,
	ressource_1_production_level INTEGER NOT NULL DEFAULT 0,
	last_updated INTEGER NOT NULL DEFAULT 0,
  building_upgrade_completes_at INTEGER NOT NULL DEFAULT 0,
	building_being_upgraded INTEGER NOT NULL DEFAULT 0,
	UNIQUE (slot, system, galaxy),
	FOREIGN KEY (owner_player_id) REFERENCES player(id) ON DELETE SET NULL
);

CREATE INDEX idx_planet_owner ON planet(owner_player_id);