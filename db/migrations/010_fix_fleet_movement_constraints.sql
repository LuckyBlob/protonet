-- Align live fleet_movement schema with intent:
--   * Make player_target_id nullable
--   * Drop FKs on planet_origin_id / planet_target_id
--   * Keep only one FK: player_origin_id -> player(id) ON DELETE CASCADE
--
-- SQLite can't alter FKs or nullability in place, so we rebuild fleet_movement.
-- The child tables fleet_movement_ship and fleet_movement_resource reference
-- fleet_movement(id) ON DELETE CASCADE, so a naive DROP of the parent while
-- foreign_keys is enforced would cascade-delete every child row.
--
-- The migration runner opens the connection with foreign_keys = ON and wraps
-- each migration in a transaction, so PRAGMA foreign_keys = OFF is a no-op
-- inside the migration. legacy_alter_table = ON also did not behave as the
-- docs suggest in better-sqlite3's SQLite build (it auto-rewrote the child FK
-- target name anyway).
--
-- Workaround: rebuild the children FIRST to drop their FK, then rebuild
-- fleet_movement (now no children point at it via FK, so DROP can't cascade),
-- then rebuild the children one more time to restore their FK against the
-- rebuilt parent. Each rebuild is self-contained.

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

--#region 3) Rebuild fleet_movement with the new FK structure

CREATE TABLE fleet_movement_temp
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
