import Database from "better-sqlite3";

// One-off renumber for the GameType enum refactor (the "Big static data refactor" that turned the old
// SCREAMING_SNAKE constants into `as const` enums AND shuffled their numeric values). Rows written by the
// OLD code stored the OLD numbers; this remaps them to the NEW enum values so they keep their meaning.
//
// Only building_type and fleet_action_type changed. resource_type (1,2,3) and ship_type (1,2,3) kept their
// numbers, so they are intentionally left untouched.
//
// Literal numbers (not GameType.* constants) on purpose: a data transfer is a frozen point-in-time
// transformation. If the enums are renumbered again later, THIS transfer must keep mapping the exact
// old->new pair it was written for.
//
//   building_type:   1 MetalMine            -> 1   (unchanged)
//                    2 CrystalGrower         -> 2   (unchanged)
//                    3 Shipyard              -> 8
//                    4 RoboticFactory        -> 9
//                    5 DeuteriumSynthesizer  -> 3
//                    6 SolarPlant            -> 4
//
//   fleet_action_type:  1 Station   -> 1   (unchanged)
//                       3 Colonize  -> 3   (unchanged)
//                       4 Collect   -> 2
//                       (2 Transport existed in the old enum but was never creatable, so no row uses it.)
//
// Each UPDATE uses a single CASE so every row is remapped from its OWN old value in one pass — there is no
// chance of an already-remapped row being remapped again (e.g. 5->3 followed by 3->8). On genuinely old
// data the targets {1,2,8,9,3,4} are all distinct, so the (planet_id, building_type) primary key never
// collides. runDataTransfers.ts records this in applied_data_transfers so it runs exactly once per DB, and
// db/init.ts marks it applied on fresh (already-new-numbered) databases so it never runs against new data.

const BUILDING_TYPE_REMAP_CASE: string = `CASE building_type
    WHEN 3 THEN 8
    WHEN 4 THEN 9
    WHEN 5 THEN 3
    WHEN 6 THEN 4
    ELSE building_type
END`;

const FLEET_ACTION_TYPE_REMAP_CASE: string = `CASE fleet_action_type
    WHEN 4 THEN 2
    ELSE fleet_action_type
END`;

export function run(databaseConnection: Database.Database): void
{
    const planetBuildingResult: Database.RunResult = databaseConnection.prepare(
        `UPDATE planet_building SET building_type = ${BUILDING_TYPE_REMAP_CASE}`
    ).run();

    const buildingUpgradeBuildingResult: Database.RunResult = databaseConnection.prepare(
        `UPDATE building_upgrade_building SET building_type = ${BUILDING_TYPE_REMAP_CASE}`
    ).run();

    const fleetMovementResult: Database.RunResult = databaseConnection.prepare(
        `UPDATE fleet_movement SET fleet_action_type = ${FLEET_ACTION_TYPE_REMAP_CASE}`
    ).run();

    console.log(`Renumbered building_type (${planetBuildingResult.changes} planet_building, ${buildingUpgradeBuildingResult.changes} building_upgrade_building) and fleet_action_type (${fleetMovementResult.changes} fleet_movement) row(s).`);
}
