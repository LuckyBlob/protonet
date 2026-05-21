CREATE TABLE IF NOT EXISTS fleet_movement
(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    planet_origin_id INTEGER NOT NULL,
    planet_target_id INTEGER NOT NULL,
    fleet_action_type INTEGER NOT NULL,
    is_return_trip INTEGER NOT NULL DEFAULT 0,
    arrival_time INTEGER NOT NULL,
    FOREIGN KEY (planet_origin_id) REFERENCES planet(id) ON DELETE CASCADE,
    FOREIGN KEY (planet_target_id) REFERENCES planet(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_fleet_movement_origin ON fleet_movement(planet_origin_id);
CREATE INDEX IF NOT EXISTS idx_fleet_movement_target ON fleet_movement(planet_target_id);
CREATE INDEX IF NOT EXISTS idx_fleet_movement_arrival ON fleet_movement(arrival_time);

CREATE TABLE IF NOT EXISTS fleet_movement_ship
(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    planet_id INTEGER NOT NULL,
    fleet_id INTEGER NOT NULL,
    ship_type INTEGER NOT NULL,
    ship_quantity INTEGER NOT NULL,
    FOREIGN KEY (planet_id) REFERENCES planet(id) ON DELETE CASCADE,
    FOREIGN KEY (fleet_id) REFERENCES fleet_movement(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_fleet_movement_ship_fleet ON fleet_movement_ship(fleet_id);
