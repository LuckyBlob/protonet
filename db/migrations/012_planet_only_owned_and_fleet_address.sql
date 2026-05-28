-- Refactor: only owned planets are stored in the DB.
--
-- Planets are now INSERTed when a player claims one and DELETEd when abandoned,
-- so there's no need for the in-progress upgrade/construction columns on the
-- planet row (they live in their dedicated building_upgrade / ship_construction
-- tables) and no need to keep unowned planet rows around at all.
--
-- Because abandoning a planet now deletes its row, fleet_movement can no longer
-- look up the origin/target planet by id to recover its address. We denormalize
-- slot/system/galaxy onto fleet_movement so in-flight fleets remain valid past
-- the deletion of their origin or target planet.
--
-- All five planet columns being dropped are plain INTEGER NOT NULL DEFAULT 0
-- with no constraints or indexes, so ALTER TABLE DROP COLUMN is sufficient
-- and we don't need the table-rebuild dance that migrations 010 and 011 used.

--#region 1) fleet_movement: add denormalized planet address columns

ALTER TABLE fleet_movement ADD COLUMN planet_origin_slot INTEGER NOT NULL DEFAULT 0;
ALTER TABLE fleet_movement ADD COLUMN planet_origin_system INTEGER NOT NULL DEFAULT 0;
ALTER TABLE fleet_movement ADD COLUMN planet_origin_galaxy INTEGER NOT NULL DEFAULT 0;
ALTER TABLE fleet_movement ADD COLUMN planet_target_slot INTEGER NOT NULL DEFAULT 0;
ALTER TABLE fleet_movement ADD COLUMN planet_target_system INTEGER NOT NULL DEFAULT 0;
ALTER TABLE fleet_movement ADD COLUMN planet_target_galaxy INTEGER NOT NULL DEFAULT 0;

-- Backfill from the still-present planet rows. Unowned planets are deleted in
-- the final step, so this MUST happen before that delete to keep the lookup
-- valid for fleets whose origin or target was an unowned (but still seeded)
-- planet at the time the fleet was created.

UPDATE fleet_movement SET
    planet_origin_slot   = (SELECT slot   FROM planet WHERE planet.id = fleet_movement.planet_origin_id),
    planet_origin_system = (SELECT system FROM planet WHERE planet.id = fleet_movement.planet_origin_id),
    planet_origin_galaxy = (SELECT galaxy FROM planet WHERE planet.id = fleet_movement.planet_origin_id),
    planet_target_slot   = (SELECT slot   FROM planet WHERE planet.id = fleet_movement.planet_target_id),
    planet_target_system = (SELECT system FROM planet WHERE planet.id = fleet_movement.planet_target_id),
    planet_target_galaxy = (SELECT galaxy FROM planet WHERE planet.id = fleet_movement.planet_target_id);

--#endregion

--#region 2) planet: drop columns that moved to dedicated tables

ALTER TABLE planet DROP COLUMN released_at;
ALTER TABLE planet DROP COLUMN building_upgrade_completes_at;
ALTER TABLE planet DROP COLUMN building_being_upgraded;
ALTER TABLE planet DROP COLUMN ship_construction_completes_at;
ALTER TABLE planet DROP COLUMN current_ship_construction_id;

--#endregion

--#region 3) planet: delete unowned rows. Migration 011 already wiped their
-- dynamic data (planet_resource / planet_building / planet_ship /
-- ship_construction / building_upgrade), and the FK is ON DELETE CASCADE so
-- any rows added since 011 also go.

DELETE FROM planet WHERE owner_player_id IS NULL;

--#endregion
