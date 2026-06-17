-- Store the fuel a fleet movement carries instead of recomputing it at resolution.
-- Fuel now depends on the origin player's engine-tech research, so the value computed
-- at departure must be persisted (mirroring fleet_movement_resource, which holds cargo)
-- rather than recalculated at the target where the origin's research may differ.

CREATE TABLE IF NOT EXISTS fleet_movement_fuel
(
    fleet_id INTEGER NOT NULL,
    resource_type INTEGER NOT NULL,
    resource_quantity INTEGER NOT NULL,
    FOREIGN KEY (fleet_id) REFERENCES fleet_movement(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_fleet_movement_fuel_fleet ON fleet_movement_fuel(fleet_id);
