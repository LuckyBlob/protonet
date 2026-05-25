INSERT OR IGNORE INTO planet_resource (planet_id, resource_type, resource_quantity)
SELECT id, 3, 1000
FROM planet;
