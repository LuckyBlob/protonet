-- Drop fleet_movement.planet_target_id. The target planet is no longer stored; it is re-derived from the
-- target coordinates (planet_target_galaxy/system/slot/zone) at arrival, and player_target_id holds the
-- intended owner for the same-player check. The column has no foreign key and no child references it, so a
-- plain DROP COLUMN suffices once its index is removed -- no table rebuild.

DROP INDEX IF EXISTS idx_fleet_movement_target;
ALTER TABLE fleet_movement DROP COLUMN planet_target_id;
