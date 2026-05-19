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
    batch_id INTEGER NOT NULL,
    ship_type INTEGER NOT NULL,
    ship_quantity INTEGER NOT NULL,
    FOREIGN KEY (planet_id) REFERENCES planet(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_ship_construction_batch ON ship_construction(batch_id);

ALTER TABLE planet ADD COLUMN current_ship_construction_batch_id INTEGER NOT NULL DEFAULT 0;
ALTER TABLE planet ADD COLUMN ship_construction_batch_completes_at INTEGER NOT NULL DEFAULT 0;

ALTER TABLE planet DROP COLUMN ressource_1;
ALTER TABLE planet DROP COLUMN ressource_1_production_level;
  
ALTER TABLE planet_ressource RENAME TO planet_resource;
ALTER TABLE planet_resource RENAME COLUMN ressource_type TO resource_type;
ALTER TABLE planet_resource RENAME COLUMN ressource_quantity TO resource_quantity;
 
DROP INDEX IF EXISTS idx_planet_resource_planet;
CREATE INDEX IF NOT EXISTS idx_planet_resource_planet ON planet_resource(planet_id);
