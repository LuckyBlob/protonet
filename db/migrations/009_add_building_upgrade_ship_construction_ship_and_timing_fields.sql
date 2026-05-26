ALTER TABLE fleet_movement ADD COLUMN requested_at INTEGER NOT NULL DEFAULT 0;
ALTER TABLE fleet_movement ADD COLUMN duration_at_request_time INTEGER NOT NULL DEFAULT 0;
ALTER TABLE fleet_movement ADD COLUMN duration_at_start_time INTEGER;
ALTER TABLE fleet_movement ADD COLUMN started_at INTEGER;

-- Backfill the new timing fields from the legacy departure_time / arrival_time before dropping those columns.
UPDATE fleet_movement
SET started_at = departure_time,
    duration_at_start_time = arrival_time - departure_time,
    requested_at = departure_time,
    duration_at_request_time = arrival_time - departure_time;

DROP INDEX IF EXISTS idx_fleet_movement_arrival;
ALTER TABLE fleet_movement DROP COLUMN departure_time;
ALTER TABLE fleet_movement DROP COLUMN arrival_time;

ALTER TABLE ship_construction ADD COLUMN requested_at INTEGER NOT NULL DEFAULT 0;
ALTER TABLE ship_construction ADD COLUMN duration_at_request_time INTEGER NOT NULL DEFAULT 0;
ALTER TABLE ship_construction ADD COLUMN duration_at_start_time INTEGER;
ALTER TABLE ship_construction ADD COLUMN started_at INTEGER;

CREATE TABLE IF NOT EXISTS ship_construction_ship
(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ship_construction_id INTEGER NOT NULL,
    ship_type INTEGER NOT NULL,
    ship_quantity INTEGER NOT NULL,
    FOREIGN KEY (ship_construction_id) REFERENCES ship_construction(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_ship_construction_ship_construction ON ship_construction_ship(ship_construction_id);

INSERT OR IGNORE INTO ship_construction_ship (ship_construction_id, ship_type, ship_quantity)
SELECT id, ship_type, ship_quantity FROM ship_construction;

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

INSERT INTO building_upgrade (planet_id, requested_at, duration_at_request_time, duration_at_start_time, started_at, current_building_upgrade_building_row_id)
SELECT id, 0, 0, NULL, 0, NULL FROM planet WHERE building_upgrade_completes_at != 0;

INSERT INTO building_upgrade_building (building_upgrade_id, building_type)
SELECT bu.id, p.building_being_upgraded
FROM building_upgrade bu JOIN planet p ON bu.planet_id = p.id;

UPDATE building_upgrade SET current_building_upgrade_building_row_id = (
    SELECT bub.id FROM building_upgrade_building bub WHERE bub.building_upgrade_id = building_upgrade.id LIMIT 1
);

ALTER TABLE ship_construction ADD COLUMN current_ship_construction_ship_row_id INTEGER;

UPDATE ship_construction SET current_ship_construction_ship_row_id = (
    SELECT scs.id FROM ship_construction_ship scs WHERE scs.ship_construction_id = ship_construction.id LIMIT 1
);

DROP INDEX IF EXISTS idx_ship_construction_batch;
ALTER TABLE ship_construction DROP COLUMN batch_id;
ALTER TABLE ship_construction DROP COLUMN ship_type;
ALTER TABLE ship_construction DROP COLUMN ship_quantity;

ALTER TABLE planet RENAME COLUMN ship_construction_batch_completes_at TO ship_construction_completes_at;
ALTER TABLE planet RENAME COLUMN current_ship_construction_batch_id TO current_ship_construction_id;
