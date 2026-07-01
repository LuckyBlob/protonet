CREATE TABLE IF NOT EXISTS pending_repair
(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    planet_id INTEGER NOT NULL,
    player_id INTEGER NOT NULL,
    created_at INTEGER NOT NULL DEFAULT 0,
    repair_started_at INTEGER,
    repair_completes_at INTEGER,
    FOREIGN KEY (planet_id) REFERENCES planet(id) ON DELETE CASCADE,
    FOREIGN KEY (player_id) REFERENCES player(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_pending_repair_player ON pending_repair(player_id);

CREATE TABLE IF NOT EXISTS pending_repair_unit
(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pending_repair_id INTEGER NOT NULL,
    unit_type INTEGER NOT NULL,
    unit_quantity INTEGER NOT NULL,
    FOREIGN KEY (pending_repair_id) REFERENCES pending_repair(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_pending_repair_unit_pending_repair ON pending_repair_unit(pending_repair_id);
