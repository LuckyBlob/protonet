CREATE TABLE IF NOT EXISTS building_deconstruction
(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    planet_id INTEGER NOT NULL,
    player_id INTEGER NOT NULL,
    requested_at INTEGER NOT NULL DEFAULT 0,
    duration_at_request_time INTEGER NOT NULL DEFAULT 0,
    duration_at_start_time INTEGER,
    started_at INTEGER,
    current_building_deconstruction_building_row_id INTEGER,
    FOREIGN KEY (planet_id) REFERENCES planet(id) ON DELETE CASCADE,
    FOREIGN KEY (player_id) REFERENCES player(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_building_deconstruction_planet ON building_deconstruction(planet_id);
CREATE INDEX IF NOT EXISTS idx_building_deconstruction_player ON building_deconstruction(player_id);

CREATE TABLE IF NOT EXISTS building_deconstruction_building
(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    building_deconstruction_id INTEGER NOT NULL,
    building_type INTEGER NOT NULL,
    FOREIGN KEY (building_deconstruction_id) REFERENCES building_deconstruction(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_building_deconstruction_building_deconstruction ON building_deconstruction_building(building_deconstruction_id);
