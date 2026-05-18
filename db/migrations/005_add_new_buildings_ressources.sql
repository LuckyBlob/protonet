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

INSERT OR IGNORE INTO planet_resource (planet_id, resource_type, resource_quantity)
SELECT id, 1, resource_1
FROM planet;

INSERT OR IGNORE INTO planet_building (planet_id, building_type, building_level)
SELECT id, 1, resource_1_production_level
FROM planet;

INSERT OR IGNORE INTO planet_building (planet_id, building_type, building_level)
SELECT id, 2, 0
FROM planet;

INSERT OR IGNORE INTO planet_building (planet_id, building_type, building_level)
SELECT id, 3, 0
FROM planet;

INSERT OR IGNORE INTO planet_resource (planet_id, resource_type, resource_quantity)
SELECT id, 2, 0
FROM planet;
