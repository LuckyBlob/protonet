CREATE TABLE IF NOT EXISTS server_config
(
	id INTEGER PRIMARY KEY CHECK (id = 1),
	time_multiplier REAL NOT NULL DEFAULT 1
);

INSERT INTO server_config (id, time_multiplier) VALUES (1, 1);