CREATE TABLE IF NOT EXISTS users
(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  email TEXT,
-- New accounts must verify their email before a player is created; legacy accounts are grandfathered verified.
  email_verified INTEGER NOT NULL DEFAULT 0,
  verify_token TEXT,
  reset_token TEXT,
--admin_levels are: 0 Power admin, 1 normal, 2+ increasing admin powers. This can ONLY be set by hand in the DB
  admin_level INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE email IS NOT NULL;

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
  invested_value INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS player_settings
(
  player_id INTEGER PRIMARY KEY,
  probes_per_send INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (player_id) REFERENCES player(id) ON DELETE CASCADE
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
	zone INTEGER NOT NULL DEFAULT 1,
	slot INTEGER NOT NULL,
	system INTEGER NOT NULL,
	galaxy INTEGER NOT NULL,
	size INTEGER NOT NULL,
	temperature INTEGER NOT NULL DEFAULT 273,
	name TEXT,
	owner_player_id INTEGER,
 	claimed_at INTEGER NOT NULL DEFAULT 0,
	last_updated INTEGER NOT NULL DEFAULT 0,
	jump_gate_ready_at INTEGER NOT NULL DEFAULT 0,
	UNIQUE (slot, system, galaxy, zone),
	FOREIGN KEY (owner_player_id) REFERENCES player(id) ON DELETE SET NULL
);

CREATE INDEX idx_planet_owner ON planet(owner_player_id);

CREATE TABLE IF NOT EXISTS planet_resource
(
	planet_id INTEGER NOT NULL,
	player_id INTEGER NOT NULL,
	resource_type INTEGER NOT NULL,
	resource_quantity REAL NOT NULL DEFAULT 0,
	PRIMARY KEY (planet_id, resource_type),
	FOREIGN KEY (planet_id) REFERENCES planet(id) ON DELETE CASCADE,
	FOREIGN KEY (player_id) REFERENCES player(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS planet_building
(
	planet_id INTEGER NOT NULL,
	player_id INTEGER NOT NULL,
	building_type INTEGER NOT NULL,
	building_level INTEGER NOT NULL DEFAULT 0,
	energy_percentage INTEGER NOT NULL DEFAULT 100,
	PRIMARY KEY (planet_id, building_type),
	FOREIGN KEY (planet_id) REFERENCES planet(id) ON DELETE CASCADE,
	FOREIGN KEY (player_id) REFERENCES player(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_planet_resource_planet ON planet_resource(planet_id);
CREATE INDEX IF NOT EXISTS idx_planet_resource_player ON planet_resource(player_id);
CREATE INDEX IF NOT EXISTS idx_planet_building_planet ON planet_building(planet_id);
CREATE INDEX IF NOT EXISTS idx_planet_building_player ON planet_building(player_id);

CREATE TABLE IF NOT EXISTS planet_unit
(
    planet_id INTEGER NOT NULL,
    player_id INTEGER NOT NULL,
    unit_type INTEGER NOT NULL,
    unit_quantity INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (planet_id, unit_type),
    FOREIGN KEY (planet_id) REFERENCES planet(id) ON DELETE CASCADE,
    FOREIGN KEY (player_id) REFERENCES player(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_planet_unit_planet ON planet_unit(planet_id);
CREATE INDEX IF NOT EXISTS idx_planet_unit_player ON planet_unit(player_id);

CREATE TABLE IF NOT EXISTS unit_construction
(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    planet_id INTEGER NOT NULL,
    player_id INTEGER NOT NULL,
    requested_at INTEGER NOT NULL DEFAULT 0,
    duration_at_request_time INTEGER NOT NULL DEFAULT 0,
    duration_at_start_time INTEGER,
    started_at INTEGER,
    current_unit_construction_unit_row_id INTEGER,
    FOREIGN KEY (planet_id) REFERENCES planet(id) ON DELETE CASCADE,
    FOREIGN KEY (player_id) REFERENCES player(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_unit_construction_player ON unit_construction(player_id);

CREATE TABLE IF NOT EXISTS unit_construction_unit
(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    unit_construction_id INTEGER NOT NULL,
    unit_type INTEGER NOT NULL,
    unit_quantity INTEGER NOT NULL,
    FOREIGN KEY (unit_construction_id) REFERENCES unit_construction(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_unit_construction_unit_construction ON unit_construction_unit(unit_construction_id);

CREATE TABLE IF NOT EXISTS pending_repair
(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    planet_id INTEGER NOT NULL,
    player_id INTEGER NOT NULL,
    created_at INTEGER NOT NULL DEFAULT 0,
    repair_started_at INTEGER,
    repair_completes_at INTEGER,
    FOREIGN KEY (planet_id) REFERENCES planet(id) ON DELETE CASCADE,
    FOREIGN KEY (player_id) REFERENCES player(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_pending_repair_player ON pending_repair(player_id);

CREATE TABLE IF NOT EXISTS pending_repair_unit
(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pending_repair_id INTEGER NOT NULL,
    unit_type INTEGER NOT NULL,
    unit_quantity INTEGER NOT NULL,
    FOREIGN KEY (pending_repair_id) REFERENCES pending_repair(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_pending_repair_unit_pending_repair ON pending_repair_unit(pending_repair_id);

CREATE TABLE IF NOT EXISTS building_upgrade
(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    planet_id INTEGER NOT NULL,
    player_id INTEGER NOT NULL,
    requested_at INTEGER NOT NULL DEFAULT 0,
    duration_at_request_time INTEGER NOT NULL DEFAULT 0,
    duration_at_start_time INTEGER,
    started_at INTEGER,
    current_building_upgrade_building_row_id INTEGER,
    FOREIGN KEY (planet_id) REFERENCES planet(id) ON DELETE CASCADE,
    FOREIGN KEY (player_id) REFERENCES player(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_building_upgrade_planet ON building_upgrade(planet_id);
CREATE INDEX IF NOT EXISTS idx_building_upgrade_player ON building_upgrade(player_id);

CREATE TABLE IF NOT EXISTS building_upgrade_building
(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    building_upgrade_id INTEGER NOT NULL,
    building_type INTEGER NOT NULL,
    FOREIGN KEY (building_upgrade_id) REFERENCES building_upgrade(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS building_upgrade_resource
(
    building_upgrade_id INTEGER NOT NULL,
    resource_type INTEGER NOT NULL,
    resource_quantity INTEGER NOT NULL,
    FOREIGN KEY (building_upgrade_id) REFERENCES building_upgrade(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_building_upgrade_resource ON building_upgrade_resource(building_upgrade_id);

CREATE TABLE IF NOT EXISTS building_deconstruction
(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    planet_id INTEGER NOT NULL,
    player_id INTEGER NOT NULL,
    requested_at INTEGER NOT NULL DEFAULT 0,
    duration_at_request_time INTEGER NOT NULL DEFAULT 0,
    duration_at_start_time INTEGER,
    started_at INTEGER,
    current_building_deconstruction_building_row_id INTEGER,
    FOREIGN KEY (planet_id) REFERENCES planet(id) ON DELETE CASCADE,
    FOREIGN KEY (player_id) REFERENCES player(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_building_deconstruction_planet ON building_deconstruction(planet_id);
CREATE INDEX IF NOT EXISTS idx_building_deconstruction_player ON building_deconstruction(player_id);

CREATE TABLE IF NOT EXISTS building_deconstruction_building
(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    building_deconstruction_id INTEGER NOT NULL,
    building_type INTEGER NOT NULL,
    FOREIGN KEY (building_deconstruction_id) REFERENCES building_deconstruction(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS building_deconstruction_resource
(
    building_deconstruction_id INTEGER NOT NULL,
    resource_type INTEGER NOT NULL,
    resource_quantity INTEGER NOT NULL,
    FOREIGN KEY (building_deconstruction_id) REFERENCES building_deconstruction(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_building_deconstruction_resource ON building_deconstruction_resource(building_deconstruction_id);

CREATE TABLE IF NOT EXISTS player_research
(
    player_id INTEGER NOT NULL,
    research_type INTEGER NOT NULL,
    research_level INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (player_id, research_type),
    FOREIGN KEY (player_id) REFERENCES player(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_player_research_player ON player_research(player_id);

CREATE TABLE IF NOT EXISTS currently_researching
(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_id INTEGER NOT NULL,
    requested_at INTEGER NOT NULL DEFAULT 0,
    duration_at_request_time INTEGER NOT NULL DEFAULT 0,
    duration_at_start_time INTEGER,
    started_at INTEGER,
    current_currently_researching_research_row_id INTEGER,
    FOREIGN KEY (player_id) REFERENCES player(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_currently_researching_player ON currently_researching(player_id);

CREATE TABLE IF NOT EXISTS currently_researching_research
(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    currently_researching_id INTEGER NOT NULL,
    research_type INTEGER NOT NULL,
    FOREIGN KEY (currently_researching_id) REFERENCES currently_researching(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS fleet_movement
(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    seed INTEGER NOT NULL,
    player_origin_id INTEGER NOT NULL,
    planet_origin_id INTEGER NOT NULL,
    planet_origin_zone INTEGER NOT NULL DEFAULT 1,
    planet_origin_slot INTEGER NOT NULL,
    planet_origin_system INTEGER NOT NULL,
    planet_origin_galaxy INTEGER NOT NULL,
    player_target_id INTEGER,
    planet_target_zone INTEGER NOT NULL DEFAULT 1,
  	planet_target_slot INTEGER NOT NULL,
    planet_target_system INTEGER NOT NULL,
    planet_target_galaxy INTEGER NOT NULL,
    is_return_trip INTEGER NOT NULL DEFAULT 0,
    fleet_action_type INTEGER NOT NULL,
    requested_at INTEGER NOT NULL DEFAULT 0,
    duration_at_request_time INTEGER NOT NULL DEFAULT 0,
    duration_at_start_time INTEGER,
    started_at INTEGER,
    unit_focus INTEGER,
    FOREIGN KEY (player_origin_id) REFERENCES player(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_fleet_movement_origin ON fleet_movement(planet_origin_id);

CREATE TABLE IF NOT EXISTS fleet_movement_unit
(
    fleet_id INTEGER NOT NULL,
    unit_type INTEGER NOT NULL,
    unit_quantity INTEGER NOT NULL,
    FOREIGN KEY (fleet_id) REFERENCES fleet_movement(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_fleet_movement_unit_fleet ON fleet_movement_unit(fleet_id);

CREATE TABLE IF NOT EXISTS fleet_movement_resource
(
    fleet_id INTEGER NOT NULL,
    resource_type INTEGER NOT NULL,
    resource_quantity INTEGER NOT NULL,
    FOREIGN KEY (fleet_id) REFERENCES fleet_movement(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_fleet_movement_resource_fleet ON fleet_movement_resource(fleet_id);

CREATE TABLE IF NOT EXISTS fleet_movement_fuel
(
    fleet_id INTEGER NOT NULL,
    resource_type INTEGER NOT NULL,
    resource_quantity INTEGER NOT NULL,
    FOREIGN KEY (fleet_id) REFERENCES fleet_movement(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_fleet_movement_fuel_fleet ON fleet_movement_fuel(fleet_id);

CREATE TABLE IF NOT EXISTS message
(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_id INTEGER NOT NULL,
    received_at INTEGER NOT NULL DEFAULT 0,
    type INTEGER NOT NULL,
    is_read INTEGER NOT NULL DEFAULT 0,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    FOREIGN KEY (player_id) REFERENCES player(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_message_player ON message(player_id);