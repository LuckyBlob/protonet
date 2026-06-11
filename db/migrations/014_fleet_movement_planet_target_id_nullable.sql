-- Make fleet_movement.planet_target_id nullable.
--
-- When a planet is abandoned, in-flight fleets that targeted it can no longer
-- reference its id (the planet row is deleted). We already null out
-- player_target_id in that case; now we also null out planet_target_id and
-- rely on the denormalized planet_target_slot/system/galaxy columns added in
-- migration 012 to recover the address.
--
-- SQLite can't alter column nullability in place, so we rebuild fleet_movement
-- using the same dance as migration 010: drop child FKs first so the parent
-- DROP can't cascade, rebuild the parent, then restore the child FKs.

--#region 1) Rebuild fleet_movement_ship without its FK to fleet_movement

CREATE TABLE fleet_movement_ship_temp
(
    fleet_id INTEGER NOT NULL,
    ship_type INTEGER NOT NULL,
    ship_quantity INTEGER NOT NULL
);

INSERT INTO fleet_movement_ship_temp SELECT * FROM fleet_movement_ship;

DROP TABLE fleet_movement_ship;
ALTER TABLE fleet_movement_ship_temp RENAME TO fleet_movement_ship;
CREATE INDEX IF NOT EXISTS idx_fleet_movement_ship_fleet ON fleet_movement_ship(fleet_id);

--#endregion

--#region 2) Rebuild fleet_movement_resource without its FK to fleet_movement

CREATE TABLE fleet_movement_resource_temp
(
    fleet_id INTEGER NOT NULL,
    resource_type INTEGER NOT NULL,
    resource_quantity INTEGER NOT NULL
);

INSERT INTO fleet_movement_resource_temp SELECT * FROM fleet_movement_resource;

DROP TABLE fleet_movement_resource;
ALTER TABLE fleet_movement_resource_temp RENAME TO fleet_movement_resource;
CREATE INDEX IF NOT EXISTS idx_fleet_movement_resource_fleet ON fleet_movement_resource(fleet_id);

--#endregion

--#region 3) Rebuild fleet_movement with planet_target_id nullable

CREATE TABLE fleet_movement_temp
(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    seed INTEGER NOT NULL,
    player_origin_id INTEGER NOT NULL,
    planet_origin_id INTEGER NOT NULL,
    planet_origin_slot INTEGER NOT NULL,
    planet_origin_system INTEGER NOT NULL,
    planet_origin_galaxy INTEGER NOT NULL,
    player_target_id INTEGER,
    planet_target_id INTEGER,
    planet_target_slot INTEGER NOT NULL,
    planet_target_system INTEGER NOT NULL,
    planet_target_galaxy INTEGER NOT NULL,
    is_return_trip INTEGER NOT NULL DEFAULT 0,
    fleet_action_type INTEGER NOT NULL,
    requested_at INTEGER NOT NULL DEFAULT 0,
    duration_at_request_time INTEGER NOT NULL DEFAULT 0,
    duration_at_start_time INTEGER,
    started_at INTEGER,
    FOREIGN KEY (player_origin_id) REFERENCES player(id) ON DELETE CASCADE
);

INSERT INTO fleet_movement_temp SELECT * FROM fleet_movement;

DROP TABLE fleet_movement;
ALTER TABLE fleet_movement_temp RENAME TO fleet_movement;
CREATE INDEX IF NOT EXISTS idx_fleet_movement_origin ON fleet_movement(planet_origin_id);
CREATE INDEX IF NOT EXISTS idx_fleet_movement_target ON fleet_movement(planet_target_id);

--#endregion

--#region 4) Rebuild fleet_movement_ship to restore its FK against the new fleet_movement

CREATE TABLE fleet_movement_ship_temp
(
    fleet_id INTEGER NOT NULL,
    ship_type INTEGER NOT NULL,
    ship_quantity INTEGER NOT NULL,
    FOREIGN KEY (fleet_id) REFERENCES fleet_movement(id) ON DELETE CASCADE
);

INSERT INTO fleet_movement_ship_temp SELECT * FROM fleet_movement_ship;

DROP TABLE fleet_movement_ship;
ALTER TABLE fleet_movement_ship_temp RENAME TO fleet_movement_ship;
CREATE INDEX IF NOT EXISTS idx_fleet_movement_ship_fleet ON fleet_movement_ship(fleet_id);

--#endregion

--#region 5) Rebuild fleet_movement_resource to restore its FK against the new fleet_movement

CREATE TABLE fleet_movement_resource_temp
(
    fleet_id INTEGER NOT NULL,
    resource_type INTEGER NOT NULL,
    resource_quantity INTEGER NOT NULL,
    FOREIGN KEY (fleet_id) REFERENCES fleet_movement(id) ON DELETE CASCADE
);

INSERT INTO fleet_movement_resource_temp SELECT * FROM fleet_movement_resource;

DROP TABLE fleet_movement_resource;
ALTER TABLE fleet_movement_resource_temp RENAME TO fleet_movement_resource;
CREATE INDEX IF NOT EXISTS idx_fleet_movement_resource_fleet ON fleet_movement_resource(fleet_id);

--#endregion
