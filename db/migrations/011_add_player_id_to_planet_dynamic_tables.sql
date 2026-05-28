-- Add player_id FK on planet-scoped dynamic tables so deleting a user
-- cascades and wipes the planet's resources, buildings, ships and any
-- in-progress construction/upgrade rows. The planet row itself stays
-- (planet.owner_player_id is set to NULL by its existing FK) but all of
-- its dynamic state is removed, which is what we want for an abandoned
-- or wiped planet.
--
-- SQLite can't add FKs in place, so we follow the same rebuild pattern
-- as migration 010. For ship_construction and building_upgrade we also
-- have to temporarily drop the children's FK before rebuilding the
-- parent (otherwise DROP TABLE on the parent cascades through the child
-- FK and wipes them), then restore it afterwards.

--#region 0) Drop orphan dynamic rows whose planet has no owner so the
-- new NOT NULL player_id column can be backfilled without nulls.

DELETE FROM planet_resource WHERE planet_id IN (SELECT id FROM planet WHERE owner_player_id IS NULL);
DELETE FROM planet_building WHERE planet_id IN (SELECT id FROM planet WHERE owner_player_id IS NULL);
DELETE FROM planet_ship WHERE planet_id IN (SELECT id FROM planet WHERE owner_player_id IS NULL);
DELETE FROM ship_construction WHERE planet_id IN (SELECT id FROM planet WHERE owner_player_id IS NULL);
DELETE FROM building_upgrade WHERE planet_id IN (SELECT id FROM planet WHERE owner_player_id IS NULL);

--#endregion

--#region 1) Rebuild planet_resource with player_id

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
    SELECT pr.planet_id, p.owner_player_id, pr.resource_type, pr.resource_quantity
    FROM planet_resource pr
    JOIN planet p ON p.id = pr.planet_id;

DROP TABLE planet_resource;
ALTER TABLE planet_resource_temp RENAME TO planet_resource;
CREATE INDEX IF NOT EXISTS idx_planet_resource_planet ON planet_resource(planet_id);
CREATE INDEX IF NOT EXISTS idx_planet_resource_player ON planet_resource(player_id);

--#endregion

--#region 2) Rebuild planet_building with player_id

CREATE TABLE planet_building_temp
(
    planet_id INTEGER NOT NULL,
    player_id INTEGER NOT NULL,
    building_type INTEGER NOT NULL,
    building_level INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (planet_id, building_type),
    FOREIGN KEY (planet_id) REFERENCES planet(id) ON DELETE CASCADE,
    FOREIGN KEY (player_id) REFERENCES player(id) ON DELETE CASCADE
);

INSERT INTO planet_building_temp (planet_id, player_id, building_type, building_level)
    SELECT pb.planet_id, p.owner_player_id, pb.building_type, pb.building_level
    FROM planet_building pb
    JOIN planet p ON p.id = pb.planet_id;

DROP TABLE planet_building;
ALTER TABLE planet_building_temp RENAME TO planet_building;
CREATE INDEX IF NOT EXISTS idx_planet_building_planet ON planet_building(planet_id);
CREATE INDEX IF NOT EXISTS idx_planet_building_player ON planet_building(player_id);

--#endregion

--#region 3) Rebuild planet_ship with player_id

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
    SELECT ps.planet_id, p.owner_player_id, ps.ship_type, ps.ship_quantity
    FROM planet_ship ps
    JOIN planet p ON p.id = ps.planet_id;

DROP TABLE planet_ship;
ALTER TABLE planet_ship_temp RENAME TO planet_ship;
CREATE INDEX IF NOT EXISTS idx_planet_ship_planet ON planet_ship(planet_id);
CREATE INDEX IF NOT EXISTS idx_planet_ship_player ON planet_ship(player_id);

--#endregion

--#region 4) Drop ship_construction_ship's FK so rebuilding ship_construction
-- doesn't cascade-delete its children.

CREATE TABLE ship_construction_ship_temp
(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ship_construction_id INTEGER NOT NULL,
    ship_type INTEGER NOT NULL,
    ship_quantity INTEGER NOT NULL
);

INSERT INTO ship_construction_ship_temp SELECT * FROM ship_construction_ship;

DROP TABLE ship_construction_ship;
ALTER TABLE ship_construction_ship_temp RENAME TO ship_construction_ship;
CREATE INDEX IF NOT EXISTS idx_ship_construction_ship_construction ON ship_construction_ship(ship_construction_id);

--#endregion

--#region 5) Rebuild ship_construction with player_id

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
    SELECT sc.id, sc.planet_id, p.owner_player_id, sc.requested_at, sc.duration_at_request_time, sc.duration_at_start_time, sc.started_at, sc.current_ship_construction_ship_row_id
    FROM ship_construction sc
    JOIN planet p ON p.id = sc.planet_id;

DROP TABLE ship_construction;
ALTER TABLE ship_construction_temp RENAME TO ship_construction;
CREATE INDEX IF NOT EXISTS idx_ship_construction_player ON ship_construction(player_id);

--#endregion

--#region 6) Restore ship_construction_ship's FK against the rebuilt ship_construction.

CREATE TABLE ship_construction_ship_temp
(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ship_construction_id INTEGER NOT NULL,
    ship_type INTEGER NOT NULL,
    ship_quantity INTEGER NOT NULL,
    FOREIGN KEY (ship_construction_id) REFERENCES ship_construction(id) ON DELETE CASCADE
);

INSERT INTO ship_construction_ship_temp SELECT * FROM ship_construction_ship;

DROP TABLE ship_construction_ship;
ALTER TABLE ship_construction_ship_temp RENAME TO ship_construction_ship;
CREATE INDEX IF NOT EXISTS idx_ship_construction_ship_construction ON ship_construction_ship(ship_construction_id);

--#endregion

--#region 7) Drop building_upgrade_building's FK so rebuilding building_upgrade
-- doesn't cascade-delete its children.

CREATE TABLE building_upgrade_building_temp
(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    building_upgrade_id INTEGER NOT NULL,
    building_type INTEGER NOT NULL
);

INSERT INTO building_upgrade_building_temp SELECT * FROM building_upgrade_building;

DROP TABLE building_upgrade_building;
ALTER TABLE building_upgrade_building_temp RENAME TO building_upgrade_building;

--#endregion

--#region 8) Rebuild building_upgrade with player_id

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
    SELECT bu.id, bu.planet_id, p.owner_player_id, bu.requested_at, bu.duration_at_request_time, bu.duration_at_start_time, bu.started_at, bu.current_building_upgrade_building_row_id
    FROM building_upgrade bu
    JOIN planet p ON p.id = bu.planet_id;

DROP TABLE building_upgrade;
ALTER TABLE building_upgrade_temp RENAME TO building_upgrade;
CREATE INDEX IF NOT EXISTS idx_building_upgrade_planet ON building_upgrade(planet_id);
CREATE INDEX IF NOT EXISTS idx_building_upgrade_player ON building_upgrade(player_id);

--#endregion

--#region 9) Restore building_upgrade_building's FK against the rebuilt building_upgrade.

CREATE TABLE building_upgrade_building_temp
(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    building_upgrade_id INTEGER NOT NULL,
    building_type INTEGER NOT NULL,
    FOREIGN KEY (building_upgrade_id) REFERENCES building_upgrade(id) ON DELETE CASCADE
);

INSERT INTO building_upgrade_building_temp SELECT * FROM building_upgrade_building;

DROP TABLE building_upgrade_building;
ALTER TABLE building_upgrade_building_temp RENAME TO building_upgrade_building;

--#endregion
