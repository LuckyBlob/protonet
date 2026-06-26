-- Rename the "ship" domain to "unit": the buildable, mobile thing is generalising beyond ships, so the
-- tables / columns / indexes that stored it are renamed in place. RENAME keeps every existing row, and on
-- SQLite >= 3.25 (default legacy_alter_table OFF) RENAME TO / RENAME COLUMN rewrite the foreign-key
-- references in child tables automatically, so the FK graph stays intact across the rename.

--#region planet_ship -> planet_unit
ALTER TABLE planet_ship RENAME TO planet_unit;
ALTER TABLE planet_unit RENAME COLUMN ship_type TO unit_type;
ALTER TABLE planet_unit RENAME COLUMN ship_quantity TO unit_quantity;
--#endregion

--#region ship_construction -> unit_construction
ALTER TABLE ship_construction RENAME TO unit_construction;
ALTER TABLE unit_construction RENAME COLUMN current_ship_construction_ship_row_id TO current_unit_construction_unit_row_id;
--#endregion

--#region ship_construction_ship -> unit_construction_unit
ALTER TABLE ship_construction_ship RENAME TO unit_construction_unit;
ALTER TABLE unit_construction_unit RENAME COLUMN ship_construction_id TO unit_construction_id;
ALTER TABLE unit_construction_unit RENAME COLUMN ship_type TO unit_type;
ALTER TABLE unit_construction_unit RENAME COLUMN ship_quantity TO unit_quantity;
--#endregion

--#region fleet_movement_ship -> fleet_movement_unit
ALTER TABLE fleet_movement_ship RENAME TO fleet_movement_unit;
ALTER TABLE fleet_movement_unit RENAME COLUMN ship_type TO unit_type;
ALTER TABLE fleet_movement_unit RENAME COLUMN ship_quantity TO unit_quantity;
--#endregion

--#region rename the indexes to match (RENAME TABLE leaves their old names pointing at the renamed table)
DROP INDEX IF EXISTS idx_planet_ship_planet;
DROP INDEX IF EXISTS idx_planet_ship_player;
DROP INDEX IF EXISTS idx_ship_construction_player;
DROP INDEX IF EXISTS idx_ship_construction_ship_construction;
DROP INDEX IF EXISTS idx_fleet_movement_ship_fleet;

CREATE INDEX IF NOT EXISTS idx_planet_unit_planet ON planet_unit(planet_id);
CREATE INDEX IF NOT EXISTS idx_planet_unit_player ON planet_unit(player_id);
CREATE INDEX IF NOT EXISTS idx_unit_construction_player ON unit_construction(player_id);
CREATE INDEX IF NOT EXISTS idx_unit_construction_unit_construction ON unit_construction_unit(unit_construction_id);
CREATE INDEX IF NOT EXISTS idx_fleet_movement_unit_fleet ON fleet_movement_unit(fleet_id);
--#endregion
