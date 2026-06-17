-- Add research, the player-level mirror of the planet-level building system.
-- player_research mirrors planet_building (what the player owns),
-- currently_researching mirrors building_upgrade (the in-progress queue row),
-- currently_researching_research mirrors building_upgrade_building (the type
-- row the in-progress queue row points at). Everything is keyed on player_id
-- instead of planet_id because research lives on the player, not the planet.

CREATE TABLE IF NOT EXISTS player_research
(
    player_id INTEGER NOT NULL,
    research_type INTEGER NOT NULL,
    research_level INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (player_id, research_type),
    FOREIGN KEY (player_id) REFERENCES player(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_player_research_player ON player_research(player_id);

CREATE TABLE IF NOT EXISTS currently_researching
(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_id INTEGER NOT NULL,
    requested_at INTEGER NOT NULL DEFAULT 0,
    duration_at_request_time INTEGER NOT NULL DEFAULT 0,
    duration_at_start_time INTEGER,
    started_at INTEGER,
    current_currently_researching_research_row_id INTEGER,
    FOREIGN KEY (player_id) REFERENCES player(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_currently_researching_player ON currently_researching(player_id);

CREATE TABLE IF NOT EXISTS currently_researching_research
(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    currently_researching_id INTEGER NOT NULL,
    research_type INTEGER NOT NULL,
    FOREIGN KEY (currently_researching_id) REFERENCES currently_researching(id) ON DELETE CASCADE
);
