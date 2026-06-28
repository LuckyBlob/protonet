-- Missile construction folded into unit_construction (queue type drives the concurrent silo queue),
-- so the dedicated missile tables are no longer used.
DROP TABLE IF EXISTS missile_construction_unit;
DROP TABLE IF EXISTS missile_construction;
