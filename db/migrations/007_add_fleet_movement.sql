ALTER TABLE planet ADD COLUMN released_at INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS fleet_movement
(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    seed INTEGER NOT NULL,
    player_origin_id INTEGER NOT NULL,
    planet_origin_id INTEGER NOT NULL,
    player_target_id INTEGER NOT NULL,
    planet_target_id INTEGER NOT NULL,
    departure_time INTEGER NOT NULL,
    arrival_time INTEGER NOT NULL,
    is_return_trip INTEGER NOT NULL DEFAULT 0,
    fleet_action_type INTEGER NOT NULL,
    FOREIGN KEY (planet_origin_id) REFERENCES planet(id) ON DELETE CASCADE,
    FOREIGN KEY (planet_target_id) REFERENCES planet(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_fleet_movement_origin ON fleet_movement(planet_origin_id);
CREATE INDEX IF NOT EXISTS idx_fleet_movement_target ON fleet_movement(planet_target_id);
CREATE INDEX IF NOT EXISTS idx_fleet_movement_arrival ON fleet_movement(arrival_time);

CREATE TABLE IF NOT EXISTS fleet_movement_ship
(
    fleet_id INTEGER NOT NULL,
    ship_type INTEGER NOT NULL,
    ship_quantity INTEGER NOT NULL,
    FOREIGN KEY (fleet_id) REFERENCES fleet_movement(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_fleet_movement_ship_fleet ON fleet_movement_ship(fleet_id);

CREATE TABLE IF NOT EXISTS fleet_movement_resource
(
    fleet_id INTEGER NOT NULL,
    resource_type INTEGER NOT NULL,
    resource_quantity INTEGER NOT NULL,
    FOREIGN KEY (fleet_id) REFERENCES fleet_movement(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_fleet_movement_resource_fleet ON fleet_movement_resource(fleet_id);
