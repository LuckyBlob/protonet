CREATE TABLE IF NOT EXISTS missile_construction
(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    planet_id INTEGER NOT NULL,
    player_id INTEGER NOT NULL,
    requested_at INTEGER NOT NULL DEFAULT 0,
    duration_at_request_time INTEGER NOT NULL DEFAULT 0,
    duration_at_start_time INTEGER,
    started_at INTEGER,
    current_missile_construction_unit_row_id INTEGER,
    FOREIGN KEY (planet_id) REFERENCES planet(id) ON DELETE CASCADE,
    FOREIGN KEY (player_id) REFERENCES player(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_missile_construction_player ON missile_construction(player_id);

CREATE TABLE IF NOT EXISTS missile_construction_unit
(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    missile_construction_id INTEGER NOT NULL,
    unit_type INTEGER NOT NULL,
    unit_quantity INTEGER NOT NULL,
    FOREIGN KEY (missile_construction_id) REFERENCES missile_construction(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_missile_construction_unit_construction ON missile_construction_unit(missile_construction_id);
