CREATE TABLE IF NOT EXISTS building_upgrade_resource
(
    building_upgrade_id INTEGER NOT NULL,
    resource_type INTEGER NOT NULL,
    resource_quantity INTEGER NOT NULL,
    FOREIGN KEY (building_upgrade_id) REFERENCES building_upgrade(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_building_upgrade_resource ON building_upgrade_resource(building_upgrade_id);

CREATE TABLE IF NOT EXISTS building_deconstruction_resource
(
    building_deconstruction_id INTEGER NOT NULL,
    resource_type INTEGER NOT NULL,
    resource_quantity INTEGER NOT NULL,
    FOREIGN KEY (building_deconstruction_id) REFERENCES building_deconstruction(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_building_deconstruction_resource ON building_deconstruction_resource(building_deconstruction_id);
