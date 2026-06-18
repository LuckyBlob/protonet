-- Per-building energy throttle. energy_percentage (0-100, 10% steps) is the share of full power a
-- player has set for a given building on a given planet. It scales the building's energy planet
-- value prod/cons and its resource production. Lives on planet_building (alongside building_level)
-- since it is a per-planet, per-building property. Existing rows default to 100 (full power).

ALTER TABLE planet_building ADD COLUMN energy_percentage INTEGER NOT NULL DEFAULT 100;
