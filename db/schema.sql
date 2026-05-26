CREATE TABLE IF NOT EXISTS users
(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
--admin_levels are: 0 Power admin, 1 normal, 2+ increasing admin powers. This can ONLY be set by hand in the DB
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
 	released_at INTEGER NOT NULL DEFAULT 0,
	last_updated INTEGER NOT NULL DEFAULT 0,
	building_upgrade_completes_at INTEGER NOT NULL DEFAULT 0,
	building_being_upgraded INTEGER NOT NULL DEFAULT 0,
  ship_construction_completes_at INTEGER NOT NULL DEFAULT 0,
	current_ship_construction_id INTEGER NOT NULL DEFAULT 0,
	UNIQUE (slot, system, galaxy),
	FOREIGN KEY (owner_player_id) REFERENCES player(id) ON DELETE SET NULL
);

CREATE INDEX idx_planet_owner ON planet(owner_player_id);

CREATE TABLE IF NOT EXISTS planet_resource
(
	planet_id INTEGER NOT NULL,
	resource_type INTEGER NOT NULL,
	resource_quantity REAL NOT NULL DEFAULT 0,
	PRIMARY KEY (planet_id, resource_type),
	FOREIGN KEY (planet_id) REFERENCES planet(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS planet_building
(
	planet_id INTEGER NOT NULL,
	building_type INTEGER NOT NULL,
	building_level INTEGER NOT NULL DEFAULT 0,
	PRIMARY KEY (planet_id, building_type),
	FOREIGN KEY (planet_id) REFERENCES planet(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_planet_resource_planet ON planet_resource(planet_id);
CREATE INDEX IF NOT EXISTS idx_planet_building_planet ON planet_building(planet_id);

CREATE TABLE IF NOT EXISTS planet_ship
(
    planet_id INTEGER NOT NULL,
    ship_type INTEGER NOT NULL,
    ship_quantity INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (planet_id, ship_type),
    FOREIGN KEY (planet_id) REFERENCES planet(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_planet_ship_planet ON planet_ship(planet_id);

CREATE TABLE IF NOT EXISTS ship_construction
(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    planet_id INTEGER NOT NULL,
    requested_at INTEGER NOT NULL DEFAULT 0,
    duration_at_request_time INTEGER NOT NULL DEFAULT 0,
    duration_at_start_time INTEGER,
    started_at INTEGER,
    current_ship_construction_ship_row_id INTEGER,
    FOREIGN KEY (planet_id) REFERENCES planet(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS ship_construction_ship
(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ship_construction_id INTEGER NOT NULL,
    ship_type INTEGER NOT NULL,
    ship_quantity INTEGER NOT NULL,
    FOREIGN KEY (ship_construction_id) REFERENCES ship_construction(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_ship_construction_ship_construction ON ship_construction_ship(ship_construction_id);

CREATE TABLE IF NOT EXISTS building_upgrade
(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    planet_id INTEGER NOT NULL,
    requested_at INTEGER NOT NULL DEFAULT 0,
    duration_at_request_time INTEGER NOT NULL DEFAULT 0,
    duration_at_start_time INTEGER,
    started_at INTEGER,
    current_building_upgrade_building_row_id INTEGER,
    FOREIGN KEY (planet_id) REFERENCES planet(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_building_upgrade_planet ON building_upgrade(planet_id);

CREATE TABLE IF NOT EXISTS building_upgrade_building
(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    building_upgrade_id INTEGER NOT NULL,
    building_type INTEGER NOT NULL,
    FOREIGN KEY (building_upgrade_id) REFERENCES building_upgrade(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS fleet_movement
(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    seed INTEGER NOT NULL,
    player_origin_id INTEGER NOT NULL,
    planet_origin_id INTEGER NOT NULL,
    player_target_id INTEGER,
    planet_target_id INTEGER NOT NULL,
    is_return_trip INTEGER NOT NULL DEFAULT 0,
    fleet_action_type INTEGER NOT NULL,
    requested_at INTEGER NOT NULL DEFAULT 0,
    duration_at_request_time INTEGER NOT NULL DEFAULT 0,
    duration_at_start_time INTEGER,
    started_at INTEGER,
    FOREIGN KEY (player_origin_id) REFERENCES player(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_fleet_movement_origin ON fleet_movement(planet_origin_id);
CREATE INDEX IF NOT EXISTS idx_fleet_movement_target ON fleet_movement(planet_target_id);

CREATE TABLE IF NOT EXISTS fleet_movement_ship
(
    fleet_id INTEGER NOT NULL,
    ship_type INTEGER NOT NULL,
    ship_quantity INTEGER NOT NULL,
    FOREIGN KEY (fleet_id) REFERENCES fleet_movement(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_fleet_movement_ship_fleet ON fleet_movement_ship(fleet_id);

CREATE TABLE IF NOT EXISTS fleet_movement_resource
(
    fleet_id INTEGER NOT NULL,
    resource_type INTEGER NOT NULL,
    resource_quantity INTEGER NOT NULL,
    FOREIGN KEY (fleet_id) REFERENCES fleet_movement(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_fleet_movement_resource_fleet ON fleet_movement_resource(fleet_id);