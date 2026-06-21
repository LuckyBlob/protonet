-- Add a `zone` tag to planets so a single coordinate can host more than one body: a normal
-- planet (zone=1), a moon (zone=2) and a debris field (zone=3). All three reuse the planet
-- machinery (their own building/ship/resource rows, fleet origin/target, anchor events).
--
-- Two schema changes are needed:
--   1. fleet_movement: two new columns (planet_origin_zone / planet_target_zone) so a fleet
--      knows which body it left and which it is heading to. These are pure ADD COLUMN — NOT a
--      rebuild. fleet_movement has historically broken when rebuilt (migration 010 made
--      planet_target_id NOT NULL and broke colonize fleets; 014 reverted it; 014 also scrambled
--      columns via SELECT *). In-flight fleets stay untouched here.
--   2. planet: a new `zone` column AND a widened UNIQUE constraint
--      (slot, system, galaxy) -> (slot, system, galaxy, zone) so a moon can sit at the same
--      coordinates as its planet. SQLite cannot alter a UNIQUE constraint in place, so `planet`
--      must be rebuilt. There is NO self-FK / parent_planet_id: a moon follows a planet's exact
--      lifecycle through the existing owner SET NULL FK, and abandon deletes all bodies at a
--      coordinate in code.
--
-- The migration runner opens the connection with foreign_keys = ON and wraps each migration in a
-- transaction, so PRAGMA foreign_keys = OFF is a no-op inside the migration. Dropping `planet`
-- with FK enforcement does an implicit DELETE of every planet row, which cascades through the
-- ON DELETE CASCADE FKs on its children and would wipe them. So we follow the proven 010/011
-- dance: strip the child FKs first (rebuild each child without its FK to the table being
-- replaced), rebuild `planet`, then restore every child FK against the rebuilt parent. The two
-- grandchildren (ship_construction_ship, building_upgrade_building) are stripped first so that
-- rebuilding ship_construction / building_upgrade does not cascade through them.
--
-- EVERY INSERT ... SELECT uses an EXPLICIT column list on both sides — never SELECT * — because
-- column physical order != schema.sql order once a column was ALTER-added (planet_building got
-- energy_percentage appended LAST by migration 017). A positional SELECT * silently scrambles
-- such tables; migration 014 corrupted fleet_movement exactly this way.

--#region 1) fleet_movement: pure ADD COLUMN (no rebuild)

ALTER TABLE fleet_movement ADD COLUMN planet_origin_zone INTEGER NOT NULL DEFAULT 1;
ALTER TABLE fleet_movement ADD COLUMN planet_target_zone INTEGER NOT NULL DEFAULT 1;

--#endregion

--#region 2) Strip ship_construction_ship's FK so rebuilding ship_construction doesn't cascade-delete it.

CREATE TABLE ship_construction_ship_temp
(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ship_construction_id INTEGER NOT NULL,
    ship_type INTEGER NOT NULL,
    ship_quantity INTEGER NOT NULL
);

INSERT INTO ship_construction_ship_temp (id, ship_construction_id, ship_type, ship_quantity)
    SELECT id, ship_construction_id, ship_type, ship_quantity FROM ship_construction_ship;

DROP TABLE ship_construction_ship;
ALTER TABLE ship_construction_ship_temp RENAME TO ship_construction_ship;
CREATE INDEX IF NOT EXISTS idx_ship_construction_ship_construction ON ship_construction_ship(ship_construction_id);

--#endregion

--#region 3) Strip building_upgrade_building's FK so rebuilding building_upgrade doesn't cascade-delete it.

CREATE TABLE building_upgrade_building_temp
(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    building_upgrade_id INTEGER NOT NULL,
    building_type INTEGER NOT NULL
);

INSERT INTO building_upgrade_building_temp (id, building_upgrade_id, building_type)
    SELECT id, building_upgrade_id, building_type FROM building_upgrade_building;

DROP TABLE building_upgrade_building;
ALTER TABLE building_upgrade_building_temp RENAME TO building_upgrade_building;

--#endregion

--#region 4) Strip planet_resource's FK to planet (keep its player FK).

CREATE TABLE planet_resource_temp
(
    planet_id INTEGER NOT NULL,
    player_id INTEGER NOT NULL,
    resource_type INTEGER NOT NULL,
    resource_quantity REAL NOT NULL DEFAULT 0,
    PRIMARY KEY (planet_id, resource_type),
    FOREIGN KEY (player_id) REFERENCES player(id) ON DELETE CASCADE
);

INSERT INTO planet_resource_temp (planet_id, player_id, resource_type, resource_quantity)
    SELECT planet_id, player_id, resource_type, resource_quantity FROM planet_resource;

DROP TABLE planet_resource;
ALTER TABLE planet_resource_temp RENAME TO planet_resource;
CREATE INDEX IF NOT EXISTS idx_planet_resource_planet ON planet_resource(planet_id);
CREATE INDEX IF NOT EXISTS idx_planet_resource_player ON planet_resource(player_id);

--#endregion

--#region 5) Strip planet_building's FK to planet (keep its player FK; keep energy_percentage).

CREATE TABLE planet_building_temp
(
    planet_id INTEGER NOT NULL,
    player_id INTEGER NOT NULL,
    building_type INTEGER NOT NULL,
    building_level INTEGER NOT NULL DEFAULT 0,
    energy_percentage INTEGER NOT NULL DEFAULT 100,
    PRIMARY KEY (planet_id, building_type),
    FOREIGN KEY (player_id) REFERENCES player(id) ON DELETE CASCADE
);

INSERT INTO planet_building_temp (planet_id, player_id, building_type, building_level, energy_percentage)
    SELECT planet_id, player_id, building_type, building_level, energy_percentage FROM planet_building;

DROP TABLE planet_building;
ALTER TABLE planet_building_temp RENAME TO planet_building;
CREATE INDEX IF NOT EXISTS idx_planet_building_planet ON planet_building(planet_id);
CREATE INDEX IF NOT EXISTS idx_planet_building_player ON planet_building(player_id);

--#endregion

--#region 6) Strip planet_ship's FK to planet (keep its player FK).

CREATE TABLE planet_ship_temp
(
    planet_id INTEGER NOT NULL,
    player_id INTEGER NOT NULL,
    ship_type INTEGER NOT NULL,
    ship_quantity INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (planet_id, ship_type),
    FOREIGN KEY (player_id) REFERENCES player(id) ON DELETE CASCADE
);

INSERT INTO planet_ship_temp (planet_id, player_id, ship_type, ship_quantity)
    SELECT planet_id, player_id, ship_type, ship_quantity FROM planet_ship;

DROP TABLE planet_ship;
ALTER TABLE planet_ship_temp RENAME TO planet_ship;
CREATE INDEX IF NOT EXISTS idx_planet_ship_planet ON planet_ship(planet_id);
CREATE INDEX IF NOT EXISTS idx_planet_ship_player ON planet_ship(player_id);

--#endregion

--#region 7) Strip ship_construction's FK to planet (keep its player FK).

CREATE TABLE ship_construction_temp
(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    planet_id INTEGER NOT NULL,
    player_id INTEGER NOT NULL,
    requested_at INTEGER NOT NULL DEFAULT 0,
    duration_at_request_time INTEGER NOT NULL DEFAULT 0,
    duration_at_start_time INTEGER,
    started_at INTEGER,
    current_ship_construction_ship_row_id INTEGER,
    FOREIGN KEY (player_id) REFERENCES player(id) ON DELETE CASCADE
);

INSERT INTO ship_construction_temp (id, planet_id, player_id, requested_at, duration_at_request_time, duration_at_start_time, started_at, current_ship_construction_ship_row_id)
    SELECT id, planet_id, player_id, requested_at, duration_at_request_time, duration_at_start_time, started_at, current_ship_construction_ship_row_id FROM ship_construction;

DROP TABLE ship_construction;
ALTER TABLE ship_construction_temp RENAME TO ship_construction;
CREATE INDEX IF NOT EXISTS idx_ship_construction_player ON ship_construction(player_id);

--#endregion

--#region 8) Strip building_upgrade's FK to planet (keep its player FK).

CREATE TABLE building_upgrade_temp
(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    planet_id INTEGER NOT NULL,
    player_id INTEGER NOT NULL,
    requested_at INTEGER NOT NULL DEFAULT 0,
    duration_at_request_time INTEGER NOT NULL DEFAULT 0,
    duration_at_start_time INTEGER,
    started_at INTEGER,
    current_building_upgrade_building_row_id INTEGER,
    FOREIGN KEY (player_id) REFERENCES player(id) ON DELETE CASCADE
);

INSERT INTO building_upgrade_temp (id, planet_id, player_id, requested_at, duration_at_request_time, duration_at_start_time, started_at, current_building_upgrade_building_row_id)
    SELECT id, planet_id, player_id, requested_at, duration_at_request_time, duration_at_start_time, started_at, current_building_upgrade_building_row_id FROM building_upgrade;

DROP TABLE building_upgrade;
ALTER TABLE building_upgrade_temp RENAME TO building_upgrade;
CREATE INDEX IF NOT EXISTS idx_building_upgrade_planet ON building_upgrade(planet_id);
CREATE INDEX IF NOT EXISTS idx_building_upgrade_player ON building_upgrade(player_id);

--#endregion

--#region 9) Rebuild planet with the new `zone` column and the widened UNIQUE constraint.
-- Original 8 columns copied explicitly; existing rows are all zone=1. No self-FK; the existing
-- owner SET NULL FK is preserved.

CREATE TABLE planet_temp
(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    zone INTEGER NOT NULL DEFAULT 1,
    slot INTEGER NOT NULL,
    system INTEGER NOT NULL,
    galaxy INTEGER NOT NULL,
    size INTEGER NOT NULL,
    owner_player_id INTEGER,
    claimed_at INTEGER NOT NULL DEFAULT 0,
    last_updated INTEGER NOT NULL DEFAULT 0,
    UNIQUE (slot, system, galaxy, zone),
    FOREIGN KEY (owner_player_id) REFERENCES player(id) ON DELETE SET NULL
);

INSERT INTO planet_temp (id, zone, slot, system, galaxy, size, owner_player_id, claimed_at, last_updated)
    SELECT id, 1, slot, system, galaxy, size, owner_player_id, claimed_at, last_updated FROM planet;

DROP TABLE planet;
ALTER TABLE planet_temp RENAME TO planet;
CREATE INDEX IF NOT EXISTS idx_planet_owner ON planet(owner_player_id);

--#endregion

--#region 10) Restore planet_resource's FK to the rebuilt planet.

CREATE TABLE planet_resource_temp
(
    planet_id INTEGER NOT NULL,
    player_id INTEGER NOT NULL,
    resource_type INTEGER NOT NULL,
    resource_quantity REAL NOT NULL DEFAULT 0,
    PRIMARY KEY (planet_id, resource_type),
    FOREIGN KEY (planet_id) REFERENCES planet(id) ON DELETE CASCADE,
    FOREIGN KEY (player_id) REFERENCES player(id) ON DELETE CASCADE
);

INSERT INTO planet_resource_temp (planet_id, player_id, resource_type, resource_quantity)
    SELECT planet_id, player_id, resource_type, resource_quantity FROM planet_resource;

DROP TABLE planet_resource;
ALTER TABLE planet_resource_temp RENAME TO planet_resource;
CREATE INDEX IF NOT EXISTS idx_planet_resource_planet ON planet_resource(planet_id);
CREATE INDEX IF NOT EXISTS idx_planet_resource_player ON planet_resource(player_id);

--#endregion

--#region 11) Restore planet_building's FK to the rebuilt planet (keep energy_percentage).

CREATE TABLE planet_building_temp
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

INSERT INTO planet_building_temp (planet_id, player_id, building_type, building_level, energy_percentage)
    SELECT planet_id, player_id, building_type, building_level, energy_percentage FROM planet_building;

DROP TABLE planet_building;
ALTER TABLE planet_building_temp RENAME TO planet_building;
CREATE INDEX IF NOT EXISTS idx_planet_building_planet ON planet_building(planet_id);
CREATE INDEX IF NOT EXISTS idx_planet_building_player ON planet_building(player_id);

--#endregion

--#region 12) Restore planet_ship's FK to the rebuilt planet.

CREATE TABLE planet_ship_temp
(
    planet_id INTEGER NOT NULL,
    player_id INTEGER NOT NULL,
    ship_type INTEGER NOT NULL,
    ship_quantity INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (planet_id, ship_type),
    FOREIGN KEY (planet_id) REFERENCES planet(id) ON DELETE CASCADE,
    FOREIGN KEY (player_id) REFERENCES player(id) ON DELETE CASCADE
);

INSERT INTO planet_ship_temp (planet_id, player_id, ship_type, ship_quantity)
    SELECT planet_id, player_id, ship_type, ship_quantity FROM planet_ship;

DROP TABLE planet_ship;
ALTER TABLE planet_ship_temp RENAME TO planet_ship;
CREATE INDEX IF NOT EXISTS idx_planet_ship_planet ON planet_ship(planet_id);
CREATE INDEX IF NOT EXISTS idx_planet_ship_player ON planet_ship(player_id);

--#endregion

--#region 13) Restore ship_construction's FK to the rebuilt planet.

CREATE TABLE ship_construction_temp
(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    planet_id INTEGER NOT NULL,
    player_id INTEGER NOT NULL,
    requested_at INTEGER NOT NULL DEFAULT 0,
    duration_at_request_time INTEGER NOT NULL DEFAULT 0,
    duration_at_start_time INTEGER,
    started_at INTEGER,
    current_ship_construction_ship_row_id INTEGER,
    FOREIGN KEY (planet_id) REFERENCES planet(id) ON DELETE CASCADE,
    FOREIGN KEY (player_id) REFERENCES player(id) ON DELETE CASCADE
);

INSERT INTO ship_construction_temp (id, planet_id, player_id, requested_at, duration_at_request_time, duration_at_start_time, started_at, current_ship_construction_ship_row_id)
    SELECT id, planet_id, player_id, requested_at, duration_at_request_time, duration_at_start_time, started_at, current_ship_construction_ship_row_id FROM ship_construction;

DROP TABLE ship_construction;
ALTER TABLE ship_construction_temp RENAME TO ship_construction;
CREATE INDEX IF NOT EXISTS idx_ship_construction_player ON ship_construction(player_id);

--#endregion

--#region 14) Restore building_upgrade's FK to the rebuilt planet.

CREATE TABLE building_upgrade_temp
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

INSERT INTO building_upgrade_temp (id, planet_id, player_id, requested_at, duration_at_request_time, duration_at_start_time, started_at, current_building_upgrade_building_row_id)
    SELECT id, planet_id, player_id, requested_at, duration_at_request_time, duration_at_start_time, started_at, current_building_upgrade_building_row_id FROM building_upgrade;

DROP TABLE building_upgrade;
ALTER TABLE building_upgrade_temp RENAME TO building_upgrade;
CREATE INDEX IF NOT EXISTS idx_building_upgrade_planet ON building_upgrade(planet_id);
CREATE INDEX IF NOT EXISTS idx_building_upgrade_player ON building_upgrade(player_id);

--#endregion

--#region 15) Restore ship_construction_ship's FK against the rebuilt ship_construction.

CREATE TABLE ship_construction_ship_temp
(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ship_construction_id INTEGER NOT NULL,
    ship_type INTEGER NOT NULL,
    ship_quantity INTEGER NOT NULL,
    FOREIGN KEY (ship_construction_id) REFERENCES ship_construction(id) ON DELETE CASCADE
);

INSERT INTO ship_construction_ship_temp (id, ship_construction_id, ship_type, ship_quantity)
    SELECT id, ship_construction_id, ship_type, ship_quantity FROM ship_construction_ship;

DROP TABLE ship_construction_ship;
ALTER TABLE ship_construction_ship_temp RENAME TO ship_construction_ship;
CREATE INDEX IF NOT EXISTS idx_ship_construction_ship_construction ON ship_construction_ship(ship_construction_id);

--#endregion

--#region 16) Restore building_upgrade_building's FK against the rebuilt building_upgrade.

CREATE TABLE building_upgrade_building_temp
(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    building_upgrade_id INTEGER NOT NULL,
    building_type INTEGER NOT NULL,
    FOREIGN KEY (building_upgrade_id) REFERENCES building_upgrade(id) ON DELETE CASCADE
);

INSERT INTO building_upgrade_building_temp (id, building_upgrade_id, building_type)
    SELECT id, building_upgrade_id, building_type FROM building_upgrade_building;

DROP TABLE building_upgrade_building;
ALTER TABLE building_upgrade_building_temp RENAME TO building_upgrade_building;

--#endregion

--#region 17) Backfill: one moon (zone=2) per owner's first planet (MIN(id) among their zone=1
-- planets), copying the planet's coords/size/owner/timestamps. The moon gets a fresh id and sits
-- at the same coordinates with zone=2 (allowed by the widened UNIQUE). An empty moon is valid:
-- its dynamic rows simply do not exist yet and read as empty maps.

INSERT INTO planet (zone, slot, system, galaxy, size, owner_player_id, claimed_at, last_updated)
    SELECT 2, p.slot, p.system, p.galaxy, p.size, p.owner_player_id, p.claimed_at, p.last_updated
    FROM planet p
    WHERE p.zone = 1
      AND p.owner_player_id IS NOT NULL
      AND p.id IN (SELECT MIN(id) FROM planet WHERE owner_player_id IS NOT NULL AND zone = 1 GROUP BY owner_player_id);

--#endregion
