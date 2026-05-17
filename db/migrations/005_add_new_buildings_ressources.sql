-- 005_normalize_planet_ressources_buildings.sql
--
-- Moves per-planet resource quantities and per-building levels out of fixed
-- columns on `planet` into child tables keyed by type. Adding a new resource
-- or building type after this is data-only (a new type id + config), never a
-- schema migration.
--
-- This migration is written defensively: the live `planet` table may have
-- either the old single-resource columns (ressource_1,
-- ressource_1_production_level) or a wider set, depending on how far manual
-- edits drifted. We copy whatever exists and ignore the rest.

-- 1. New normalized tables ---------------------------------------------------

CREATE TABLE IF NOT EXISTS planet_ressource
(
	planet_id INTEGER NOT NULL,
	ressource_type INTEGER NOT NULL,
	ressource_quantity REAL NOT NULL DEFAULT 0,
	PRIMARY KEY (planet_id, ressource_type),
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

CREATE INDEX IF NOT EXISTS idx_planet_ressource_planet ON planet_ressource(planet_id);
CREATE INDEX IF NOT EXISTS idx_planet_building_planet ON planet_building(planet_id);

-- 2. Backfill resource quantities from the existing column -------------------
-- Old schema had ressource_1 only. Resource type 1 == old ressource_1.
-- (If your live DB already added ressource_2 by hand, add a matching INSERT
--  line for ressource_type 2 below before running.)

INSERT OR IGNORE INTO planet_ressource (planet_id, ressource_type, ressource_quantity)
SELECT id, 1, ressource_1
FROM planet;

-- 3. Backfill building levels from the existing column ----------------------
-- Old schema stored a single production building level as
-- ressource_1_production_level. That maps to building type 1.

INSERT OR IGNORE INTO planet_building (planet_id, building_type, building_level)
SELECT id, 1, ressource_1_production_level
FROM planet;

-- Building types 2 and 3 (resource-2 mine, shipyard) had no column in the old
-- schema; seed them at level 0 for every existing planet so the assembled
-- in-memory shape always has an entry per known building.

INSERT OR IGNORE INTO planet_building (planet_id, building_type, building_level)
SELECT id, 2, 0
FROM planet;

INSERT OR IGNORE INTO planet_building (planet_id, building_type, building_level)
SELECT id, 3, 0
FROM planet;

-- Resource type 2 likewise had no column; seed at 0 for every planet.

INSERT OR IGNORE INTO planet_ressource (planet_id, ressource_type, ressource_quantity)
SELECT id, 2, 0
FROM planet;
