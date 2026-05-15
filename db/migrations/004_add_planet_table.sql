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