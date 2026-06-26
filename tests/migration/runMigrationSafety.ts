// Why this file exists:
// Recurring production breakage comes from PENDING actions (building upgrades, ship constructions,
// fleet movements) that were written by the OLD code and then have to survive a deploy: the schema
// migration runs, and the NEW code must still be able to LOAD them (login before they complete) and
// RESOLVE them (login after they complete). Nothing else in the pipeline exercises that old->new
// transition, because every other test creates data with the new code against an already-migrated DB.
//
// This harness reproduces the transition end to end, with ZERO per-run human work:
//   1. Copy the source DB (the pre-migration DB) to a throwaway file.
//      - Dev:    source = data/game.db          (you guarantee it is unmigrated; we fail loudly if not).
//      - Server: source = $MIGRATION_TEST_SOURCE_DB (deploy points this at the still-untouched LIVE_DB).
//   2. Assert the copy is actually unmigrated (pending migrations exist) — this is the dev safety net.
//   3. Inject guaranteed-coverage synthetic pending actions in OLD-schema form, in two cohorts:
//        - "before end": started now, completes far in the future  -> exercises LOAD of a pending action.
//        - "after end":  completed in the past                      -> exercises RESOLUTION on load.
//   4. Run the real `db:migrate` + `db:transfer` against the copy (the exact scripts the deploy runs).
//   5. Load every player with the NEW code (applyPlayerUpdate), once "now" and once far in the future,
//      and assert none throw. Synthetic players guarantee coverage; the real copied players give the
//      genuine production-data fidelity that catches the bugs we actually hit.
//   6. Delete the throwaway copy.
//
// Run with: pnpm test:migration

import Database from "better-sqlite3";
import { execFileSync } from "child_process";
import { existsSync, readdirSync, rmSync } from "fs";
import { dirname, join } from "path";
import { tmpdir } from "os";

import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";

//#region constants

const PROJECT_ROOT: string = process.cwd();
const SOURCE_DATABASE_PATH: string = process.env.MIGRATION_TEST_SOURCE_DB ?? join(PROJECT_ROOT, "data", "game.db");
const TEMP_DATABASE_PATH: string = join(tmpdir(), `protonet-migration-safety-${process.pid}.db`);
const MIGRATIONS_DIRECTORY_PATH: string = join(PROJECT_ROOT, "db", "migrations");

const ONE_DAY_MS: number = 24 * 60 * 60 * 1000;
const FAR_FUTURE_MS: number = 10 * 365 * ONE_DAY_MS;

// The moon-backfill assertion only means something while these migrations are still pending: they CREATE
// moon rows for existing planets, and the synthetic players are injected (moonless) after the snapshot.
// Once the source DB already has them applied, migrate is a no-op for them and the injected players can
// never gain moons, so the check would fail forever. Guard it on both being pending.
const MOON_BACKFILL_MIGRATION_PREFIXES: string[] = ["018_", "020_"];

//#endregion

//#region pure helpers

function getPendingMigrationFilenames(databaseConnection: Database.Database): string[]
{
    const appliedMigrationFilenames: Set<string> = new Set<string>();

    const appliedMigrationsTableExists: boolean = databaseConnection.prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'applied_migrations'"
    ).get() !== undefined;

    if (appliedMigrationsTableExists === true)
    {
        const appliedRows: { filename: string }[] = databaseConnection.prepare(
            "SELECT filename FROM applied_migrations"
        ).all() as { filename: string }[];

        for (const appliedRow of appliedRows)
        {
            appliedMigrationFilenames.add(appliedRow.filename);
        }
    }

    const allMigrationFilenames: string[] = readdirSync(MIGRATIONS_DIRECTORY_PATH)
        .filter((filename: string): boolean => filename.endsWith(".sql"))
        .sort();

    const pendingMigrationFilenames: string[] = allMigrationFilenames.filter(
        (filename: string): boolean => appliedMigrationFilenames.has(filename) === false
    );

    return pendingMigrationFilenames;
}

function areAllMigrationsPending(pendingMigrationFilenames: string[], migrationPrefixes: string[]): boolean
{
    return migrationPrefixes.every((migrationPrefix: string): boolean =>
        pendingMigrationFilenames.some((filename: string): boolean => filename.startsWith(migrationPrefix)));
}

function removeDatabaseFiles(databaseFilePath: string): void
{
    for (const suffix of ["", "-wal", "-shm"])
    {
        const candidatePath: string = `${databaseFilePath}${suffix}`;
        if (existsSync(candidatePath) === true)
        {
            // Best-effort: on Windows a lingering open handle can lock the file. A failed cleanup of a
            // throwaway temp DB must never mask the real pass/fail signal, so swallow the error.
            try
            {
                rmSync(candidatePath, { force: true });
            }
            catch (error: unknown)
            {
                console.error("⚠️:", `Could not remove temp DB file ${candidatePath}: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
    }
}

// Removes the throwaway copy AND the backup files that `db/migrate.ts` / `db/runDataTransfers.ts` drop next
// to it (hardcoded `game.db.backup.N` / `game.db.transferBackup.N` in the temp dir) so /tmp does not slowly
// fill across runs. Best-effort: cleanup must never change the pass/fail signal.
function cleanupTempArtifacts(): void
{
    removeDatabaseFiles(TEMP_DATABASE_PATH);

    const tempDirectoryPath: string = dirname(TEMP_DATABASE_PATH);
    const backupFilenames: string[] = readdirSync(tempDirectoryPath).filter(
        (filename: string): boolean => filename.startsWith("game.db.backup.") === true || filename.startsWith("game.db.transferBackup.") === true
    );

    for (const backupFilename of backupFilenames)
    {
        const backupFilePath: string = join(tempDirectoryPath, backupFilename);
        try
        {
            rmSync(backupFilePath, { force: true });
        }
        catch (error: unknown)
        {
            console.error("⚠️:", `Could not remove temp backup file ${backupFilePath}: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
}

//#endregion

//#region synthetic injection

type Cohort = "before-end" | "after-end";

// Cohorts split the before/after-end coverage across players (this list also sets HOW MANY players):
//   - "before-end": the started action completes far in the future -> exercises LOADING full queues.
//   - "after-end":  the started action completed in the past        -> exercises RESOLUTION + queue advance.
const SYNTHETIC_PLAYER_COHORTS: Cohort[] = ["before-end", "after-end", "before-end"];
const SYNTHETIC_PLANETS_PER_PLAYER: number = 3;
const SYNTHETIC_ACTIONS_PER_PLANET: number = 6;
const SYNTHETIC_GALAXY: number = 999999;
// db:transfer runs against this copy, so the synthetic rows go through any renumber data transfer (e.g. 003)
// alongside the real ones. Inject only building types whose number is UNCHANGED by those transfers
// (MetalMine, CrystalGrower) so a synthetic planet never collides on (planet_id, building_type) when a value
// is remapped (e.g. DeuteriumSynthesizer 3 -> 8 onto Shipyard 8) and never silently mis-maps. The renumber
// itself is exercised end-to-end by the real copied prod rows and pinned semantically in
// tests/integration/renumberDataTransfer.test.ts. If a future transfer renumbers these stable types too,
// pick the new stable set here. resource_type and ship_type were not renumbered.
const BUILDING_TYPES: number[] = [GameType.BuildingType.MetalMine, GameType.BuildingType.CrystalGrower];
const RESOURCE_TYPES: number[] = [GameType.ResourceType.Metal, GameType.ResourceType.Crystal, GameType.ResourceType.Deuterium];

// The `started_at` of the first (active) action in each queue. For "after-end" it sits far enough in the
// past that the active action — and several queued behind it — have all completed.
function startedActionStartedAt(cohort: Cohort, now: number): number
{
    return cohort === "before-end" ? now : now - 100 * ONE_DAY_MS;
}

// The duration of the first (active) action. "before-end" never completes; "after-end" completed long ago.
function startedActionDurationMs(cohort: Cohort): number
{
    return cohort === "before-end" ? FAR_FUTURE_MS : ONE_DAY_MS;
}

// Injects every synthetic account, each with several planets, each planet carrying 5-6 of every pending
// action type, queued (only the first in each queue is "started"; the rest wait their turn, exactly like
// the real action logic). Only references columns that exist in the pre-migration (old) schema — surviving
// the migration is what we are testing. Returns the set of injected player ids.
function injectSyntheticPlayers(databaseConnection: Database.Database): Set<number>
{
    const syntheticPlayerIds: Set<number> = new Set<number>();

    for (let playerIndex: number = 0; playerIndex < SYNTHETIC_PLAYER_COHORTS.length; playerIndex = playerIndex + 1)
    {
        const cohort: Cohort = SYNTHETIC_PLAYER_COHORTS[playerIndex];
        const playerId: number = injectSyntheticPlayer(databaseConnection, playerIndex, cohort);
        syntheticPlayerIds.add(playerId);
    }

    return syntheticPlayerIds;
}

function injectSyntheticPlayer(databaseConnection: Database.Database, playerIndex: number, cohort: Cohort): number
{
    const now: number = Date.now();

    const userInsert: { id: number } = databaseConnection.prepare(
        "INSERT INTO users (username, password_hash, admin_level, created_at) VALUES (?, ?, 1, ?) RETURNING id"
    ).get(`migration_test_${cohort}_${playerIndex}_${now}`, "x", now) as { id: number };

    const playerInsert: { id: number } = databaseConnection.prepare(
        "INSERT INTO player (user_id, gold, upgrade_level, last_updated, building_upgrade_completes_at) VALUES (?, 100, 0, ?, 0) RETURNING id"
    ).get(userInsert.id, now - ONE_DAY_MS) as { id: number };
    const playerId: number = playerInsert.id;

    for (let planetIndex: number = 0; planetIndex < SYNTHETIC_PLANETS_PER_PLAYER; planetIndex = planetIndex + 1)
    {
        injectSyntheticPlanet(databaseConnection, playerId, playerIndex, planetIndex, cohort);
    }

    return playerId;
}

function injectSyntheticPlanet(databaseConnection: Database.Database, playerId: number, playerIndex: number, planetIndex: number, cohort: Cohort): void
{
    const now: number = Date.now();
    // Unique (slot, system, galaxy) per synthetic planet so the planet UNIQUE constraint never collides.
    const slot: number = planetIndex + 1;
    const system: number = playerIndex + 1;

    const planetInsert: { id: number } = databaseConnection.prepare(
        "INSERT INTO planet (slot, system, galaxy, size, owner_player_id, claimed_at, last_updated) VALUES (?, ?, ?, 200, ?, ?, ?) RETURNING id"
    ).get(slot, system, SYNTHETIC_GALAXY, playerId, now - ONE_DAY_MS, now - ONE_DAY_MS) as { id: number };
    const planetId: number = planetInsert.id;

    // Distinctive, mutually-different building_level vs energy_percentage per building so the planet
    // rebuild's value-preservation check would catch a positional column shift — most importantly a
    // building_level <-> energy_percentage swap, since energy_percentage was ALTER-appended LAST
    // (migration 017) and is the column most at risk (see project_migration_column_order).
    const buildingInsert: Database.Statement = databaseConnection.prepare(
        "INSERT INTO planet_building (planet_id, player_id, building_type, building_level, energy_percentage) VALUES (?, ?, ?, ?, ?)"
    );
    let buildingIndex: number = 0;
    for (const buildingType of BUILDING_TYPES)
    {
        const buildingLevel: number = 3 + buildingIndex;
        const energyPercentage: number = 40 + 10 * buildingIndex;
        buildingInsert.run(planetId, playerId, buildingType, buildingLevel, energyPercentage);
        buildingIndex = buildingIndex + 1;
    }

    const resourceInsert: Database.Statement = databaseConnection.prepare(
        "INSERT INTO planet_resource (planet_id, player_id, resource_type, resource_quantity) VALUES (?, ?, ?, 100000)"
    );
    for (const resourceType of RESOURCE_TYPES)
    {
        resourceInsert.run(planetId, playerId, resourceType);
    }

    databaseConnection.prepare(
        "INSERT INTO planet_ship (planet_id, player_id, ship_type, ship_quantity) VALUES (?, ?, ?, 5)"
    ).run(planetId, playerId, GameType.UnitType.SmallTransport);

    injectBuildingUpgrade(databaseConnection, planetId, playerId, cohort, now);
    injectShipConstructionQueue(databaseConnection, planetId, playerId, cohort, now);
    injectFleetMovements(databaseConnection, planetId, playerId, slot, system, now);
}

// Building upgrades do NOT queue — exactly one building_upgrade (with a single building_upgrade_building row)
// per planet. The game enforces this (buildingUpgradeAnchorEvent.ts throws if more than one is pending), and
// the multi-building-row shape exists only for symmetry with ship construction, so we inject just one.
function injectBuildingUpgrade(databaseConnection: Database.Database, planetId: number, playerId: number, cohort: Cohort, now: number): void
{
    const startedAt: number = startedActionStartedAt(cohort, now);
    const durationAtStart: number = startedActionDurationMs(cohort);

    const upgradeInsert: { id: number } = databaseConnection.prepare(
        "INSERT INTO building_upgrade (planet_id, player_id, requested_at, duration_at_request_time, duration_at_start_time, started_at, current_building_upgrade_building_row_id) VALUES (?, ?, ?, ?, ?, ?, -1) RETURNING id"
    ).get(planetId, playerId, now - ONE_DAY_MS, ONE_DAY_MS, durationAtStart, startedAt) as { id: number };

    const buildingInsert: { id: number } = databaseConnection.prepare(
        "INSERT INTO building_upgrade_building (building_upgrade_id, building_type) VALUES (?, ?) RETURNING id"
    ).get(upgradeInsert.id, GameType.BuildingType.MetalMine) as { id: number };

    databaseConnection.prepare(
        "UPDATE building_upgrade SET current_building_upgrade_building_row_id = ? WHERE id = ?"
    ).run(buildingInsert.id, upgradeInsert.id);
}

function injectShipConstructionQueue(databaseConnection: Database.Database, planetId: number, playerId: number, cohort: Cohort, now: number): void
{
    const insertConstruction: Database.Statement = databaseConnection.prepare(
        "INSERT INTO ship_construction (planet_id, player_id, requested_at, duration_at_request_time, duration_at_start_time, started_at, current_ship_construction_ship_row_id) VALUES (?, ?, ?, ?, ?, ?, -1) RETURNING id"
    );
    const insertShip: Database.Statement = databaseConnection.prepare(
        "INSERT INTO ship_construction_ship (ship_construction_id, ship_type, ship_quantity) VALUES (?, ?, 3) RETURNING id"
    );
    const updateCurrent: Database.Statement = databaseConnection.prepare(
        "UPDATE ship_construction SET current_ship_construction_ship_row_id = ? WHERE id = ?"
    );

    for (let actionIndex: number = 0; actionIndex < SYNTHETIC_ACTIONS_PER_PLANET; actionIndex = actionIndex + 1)
    {
        const isStarted: boolean = actionIndex === 0;
        const startedAt: number | null = isStarted ? startedActionStartedAt(cohort, now) : null;
        const durationAtStart: number | null = isStarted ? startedActionDurationMs(cohort) : null;

        const constructionInsert: { id: number } = insertConstruction.get(planetId, playerId, now - ONE_DAY_MS, ONE_DAY_MS, durationAtStart, startedAt) as { id: number };
        const shipInsert: { id: number } = insertShip.get(constructionInsert.id, GameType.UnitType.SmallTransport) as { id: number };
        updateCurrent.run(shipInsert.id, constructionInsert.id);
    }
}

// SYNTHETIC_ACTIONS_PER_PLANET fleets, all completing far in the future (load-only) regardless of cohort:
// resolving an arrival needs a real target planet, so synthetic fleets only exercise LOADING. Real overdue
// fleets in the copied live DB cover fleet RESOLUTION.
function injectFleetMovements(databaseConnection: Database.Database, planetId: number, playerId: number, slot: number, system: number, now: number): void
{
    const insertFleet: Database.Statement = databaseConnection.prepare(
        "INSERT INTO fleet_movement (seed, player_origin_id, planet_origin_id, planet_origin_slot, planet_origin_system, planet_origin_galaxy, player_target_id, planet_target_slot, planet_target_system, planet_target_galaxy, is_return_trip, fleet_action_type, requested_at, duration_at_request_time, duration_at_start_time, started_at) VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, 0, 1, ?, ?, ?, ?) RETURNING id"
    );
    const insertFleetShip: Database.Statement = databaseConnection.prepare(
        "INSERT INTO fleet_movement_ship (fleet_id, ship_type, ship_quantity) VALUES (?, ?, 2)"
    );
    // Cargo + fuel children: these ride along with the fleet. They are not rebuilt by 018, but seeding
    // them keeps the fixture shaped like a real in-flight fleet and lets the value-preservation check
    // cover them too.
    const insertFleetResource: Database.Statement = databaseConnection.prepare(
        "INSERT INTO fleet_movement_resource (fleet_id, resource_type, resource_quantity) VALUES (?, ?, 1000)"
    );
    const insertFleetFuel: Database.Statement = databaseConnection.prepare(
        "INSERT INTO fleet_movement_fuel (fleet_id, resource_type, resource_quantity) VALUES (?, ?, 50)"
    );

    for (let actionIndex: number = 0; actionIndex < SYNTHETIC_ACTIONS_PER_PLANET; actionIndex = actionIndex + 1)
    {
        const fleetInsert: { id: number } = insertFleet.get(12345 + actionIndex, playerId, planetId, slot, system, SYNTHETIC_GALAXY, slot + 1, system, SYNTHETIC_GALAXY, now, FAR_FUTURE_MS, FAR_FUTURE_MS, now) as { id: number };
        insertFleetShip.run(fleetInsert.id, GameType.UnitType.SmallTransport);
        insertFleetResource.run(fleetInsert.id, GameType.ResourceType.Metal);
        insertFleetFuel.run(fleetInsert.id, GameType.ResourceType.Deuterium);
    }
}

//#endregion

//#region value preservation (the planet rebuild must not shift or drop columns)

// The whole risk of migration 018 is the planet rebuild silently SHIFTING a column (a positional
// SELECT *), which preserves row COUNTS while corrupting VALUES — exactly the class of bug that hit
// fleet_movement before (see project_migration_column_order). Row-count checks cannot catch it, so we
// snapshot the synthetic rows of every rebuilt table BEFORE the migration and assert they come back
// byte-for-byte AFTER migrate + transfer. Scoped to synthetic players because their building / ship /
// resource / fleet-action types are renumber-STABLE, so db:transfer's 003 renumber can't confound the
// diff; the real copied rows are covered by the load checks.
//
// Migration 024 renames the ship_* tables/columns to unit_* in place. The synthetic rows are injected in
// the pre-migration (ship_*) schema, so the BEFORE snapshot reads ship_* and the AFTER snapshot reads the
// renamed unit_* tables, aliasing each renamed column back to its old ship_* key so the byte-for-byte
// JSON compare still lines up (a pure RENAME can't shift values; this only keeps the keys identical).

type TableSnapshot =
{
    label: string;
    rows: Record<string, unknown>[];
};

function captureSyntheticSnapshot(connection: Database.Database, syntheticPlayerIds: Set<number>, postMigration: boolean): TableSnapshot[]
{
    const idList: string = Array.from(syntheticPlayerIds).join(", ");
    // Post-migration the planet table also holds the backfilled moons (zone=2) and has gained a zone
    // column; restrict the equality snapshot to the original zone=1 planets. Pre-migration there is no
    // zone column, so the filter is only added afterwards.
    const planetZoneFilter: string = postMigration === true ? "AND zone = 1" : "";

    const snapshots: TableSnapshot[] =
    [
        {
            label: "planet",
            rows: connection.prepare(
                `SELECT id, slot, system, galaxy, size, owner_player_id, claimed_at, last_updated FROM planet WHERE owner_player_id IN (${idList}) ${planetZoneFilter} ORDER BY id`
            ).all() as Record<string, unknown>[],
        },
        {
            label: "planet_resource",
            rows: connection.prepare(
                `SELECT planet_id, player_id, resource_type, resource_quantity FROM planet_resource WHERE player_id IN (${idList}) ORDER BY planet_id, resource_type`
            ).all() as Record<string, unknown>[],
        },
        {
            label: "planet_building",
            rows: connection.prepare(
                `SELECT planet_id, player_id, building_type, building_level, energy_percentage FROM planet_building WHERE player_id IN (${idList}) ORDER BY planet_id, building_type`
            ).all() as Record<string, unknown>[],
        },
        {
            label: "planet_ship",
            rows: connection.prepare(
                postMigration === true
                    ? `SELECT planet_id, player_id, unit_type AS ship_type, unit_quantity AS ship_quantity FROM planet_unit WHERE player_id IN (${idList}) ORDER BY planet_id, unit_type`
                    : `SELECT planet_id, player_id, ship_type, ship_quantity FROM planet_ship WHERE player_id IN (${idList}) ORDER BY planet_id, ship_type`
            ).all() as Record<string, unknown>[],
        },
        {
            label: "ship_construction",
            rows: connection.prepare(
                postMigration === true
                    ? `SELECT id, planet_id, player_id, requested_at, duration_at_request_time, duration_at_start_time, started_at, current_unit_construction_unit_row_id AS current_ship_construction_ship_row_id FROM unit_construction WHERE player_id IN (${idList}) ORDER BY id`
                    : `SELECT id, planet_id, player_id, requested_at, duration_at_request_time, duration_at_start_time, started_at, current_ship_construction_ship_row_id FROM ship_construction WHERE player_id IN (${idList}) ORDER BY id`
            ).all() as Record<string, unknown>[],
        },
        {
            label: "ship_construction_ship",
            rows: connection.prepare(
                postMigration === true
                    ? `SELECT id, unit_construction_id AS ship_construction_id, unit_type AS ship_type, unit_quantity AS ship_quantity FROM unit_construction_unit WHERE unit_construction_id IN (SELECT id FROM unit_construction WHERE player_id IN (${idList})) ORDER BY id`
                    : `SELECT id, ship_construction_id, ship_type, ship_quantity FROM ship_construction_ship WHERE ship_construction_id IN (SELECT id FROM ship_construction WHERE player_id IN (${idList})) ORDER BY id`
            ).all() as Record<string, unknown>[],
        },
        {
            label: "building_upgrade",
            rows: connection.prepare(
                `SELECT id, planet_id, player_id, requested_at, duration_at_request_time, duration_at_start_time, started_at, current_building_upgrade_building_row_id FROM building_upgrade WHERE player_id IN (${idList}) ORDER BY id`
            ).all() as Record<string, unknown>[],
        },
        {
            label: "building_upgrade_building",
            rows: connection.prepare(
                `SELECT id, building_upgrade_id, building_type FROM building_upgrade_building WHERE building_upgrade_id IN (SELECT id FROM building_upgrade WHERE player_id IN (${idList})) ORDER BY id`
            ).all() as Record<string, unknown>[],
        },
        {
            label: "fleet_movement",
            rows: connection.prepare(
                `SELECT id, seed, player_origin_id, planet_origin_id, planet_origin_slot, planet_origin_system, planet_origin_galaxy, player_target_id, planet_target_slot, planet_target_system, planet_target_galaxy, is_return_trip, fleet_action_type, requested_at, duration_at_request_time, duration_at_start_time, started_at FROM fleet_movement WHERE player_origin_id IN (${idList}) ORDER BY id`
            ).all() as Record<string, unknown>[],
        },
        {
            label: "fleet_movement_ship",
            rows: connection.prepare(
                postMigration === true
                    ? `SELECT fleet_id, unit_type AS ship_type, unit_quantity AS ship_quantity FROM fleet_movement_unit WHERE fleet_id IN (SELECT id FROM fleet_movement WHERE player_origin_id IN (${idList})) ORDER BY fleet_id, unit_type`
                    : `SELECT fleet_id, ship_type, ship_quantity FROM fleet_movement_ship WHERE fleet_id IN (SELECT id FROM fleet_movement WHERE player_origin_id IN (${idList})) ORDER BY fleet_id, ship_type`
            ).all() as Record<string, unknown>[],
        },
        {
            label: "fleet_movement_resource",
            rows: connection.prepare(
                `SELECT fleet_id, resource_type, resource_quantity FROM fleet_movement_resource WHERE fleet_id IN (SELECT id FROM fleet_movement WHERE player_origin_id IN (${idList})) ORDER BY fleet_id, resource_type`
            ).all() as Record<string, unknown>[],
        },
        {
            label: "fleet_movement_fuel",
            rows: connection.prepare(
                `SELECT fleet_id, resource_type, resource_quantity FROM fleet_movement_fuel WHERE fleet_id IN (SELECT id FROM fleet_movement WHERE player_origin_id IN (${idList})) ORDER BY fleet_id, resource_type`
            ).all() as Record<string, unknown>[],
        },
    ];

    return snapshots;
}

// Diffs the before/after snapshots value-by-value. A label present in one and not the other, a changed
// row count, or any changed cell is a failure (the row objects keep their SELECT column order, so a
// stringify compare is exact).
function collectSnapshotValueFailures(beforeSnapshots: TableSnapshot[], afterSnapshots: TableSnapshot[]): string[]
{
    const valueFailures: string[] = [];

    for (const beforeSnapshot of beforeSnapshots)
    {
        const afterSnapshot: TableSnapshot | undefined = afterSnapshots.find(
            (snapshot: TableSnapshot): boolean => snapshot.label === beforeSnapshot.label
        );
        if (afterSnapshot === undefined)
        {
            valueFailures.push(`${beforeSnapshot.label}: table missing after migration`);
            continue;
        }

        const beforeJson: string = JSON.stringify(beforeSnapshot.rows);
        const afterJson: string = JSON.stringify(afterSnapshot.rows);
        if (beforeJson !== afterJson)
        {
            valueFailures.push(`${beforeSnapshot.label}: ${beforeSnapshot.rows.length} row(s) before vs ${afterSnapshot.rows.length} after — values changed across the migration.\n  before: ${beforeJson}\n  after:  ${afterJson}`);
        }
    }

    return valueFailures;
}

// Asserts 018 + 020's backfill: a moon (zone=2) on each synthetic player's TWO oldest planets
// (018 did the first, 020 the second), each sitting at its planet's coordinates and copying its
// owner / size / timestamps.
function collectMoonBackfillValueFailures(connection: Database.Database, syntheticPlayerIds: Set<number>): string[]
{
    const valueFailures: string[] = [];

    for (const playerId of syntheticPlayerIds)
    {
        const oldestPlanets: Record<string, unknown>[] = connection.prepare(
            "SELECT slot, system, galaxy, size, owner_player_id, claimed_at, last_updated FROM planet WHERE owner_player_id = ? AND zone = 1 ORDER BY claimed_at ASC, id ASC LIMIT 2"
        ).all(playerId) as Record<string, unknown>[];

        if (oldestPlanets.length === 0)
        {
            valueFailures.push(`moon backfill: synthetic player ${playerId} has no zone=1 planet`);
            continue;
        }

        const moonRows: Record<string, unknown>[] = connection.prepare(
            "SELECT slot, system, galaxy, size, owner_player_id, claimed_at, last_updated FROM planet WHERE owner_player_id = ? AND zone = 2 ORDER BY claimed_at ASC, id ASC"
        ).all(playerId) as Record<string, unknown>[];

        if (moonRows.length !== oldestPlanets.length)
        {
            valueFailures.push(`moon backfill: synthetic player ${playerId} has ${moonRows.length} moon(s), expected ${oldestPlanets.length}`);
            continue;
        }

        for (let planetIndex: number = 0; planetIndex < oldestPlanets.length; planetIndex = planetIndex + 1)
        {
            if (JSON.stringify(moonRows[planetIndex]) !== JSON.stringify(oldestPlanets[planetIndex]))
            {
                valueFailures.push(`moon backfill: synthetic player ${playerId} moon ${JSON.stringify(moonRows[planetIndex])} does not match its planet ${JSON.stringify(oldestPlanets[planetIndex])}`);
            }
        }
    }

    return valueFailures;
}

// Asserts the new fleet zone columns defaulted to 1 (Planet) on the pre-existing in-flight fleets.
function collectFleetZoneValueFailures(connection: Database.Database, syntheticPlayerIds: Set<number>): string[]
{
    const idList: string = Array.from(syntheticPlayerIds).join(", ");
    const badFleets: Record<string, unknown>[] = connection.prepare(
        `SELECT id, planet_origin_zone, planet_target_zone FROM fleet_movement WHERE player_origin_id IN (${idList}) AND (planet_origin_zone <> 1 OR planet_target_zone <> 1)`
    ).all() as Record<string, unknown>[];

    if (badFleets.length === 0)
    {
        return [];
    }

    return [`fleet zone backfill: ${badFleets.length} synthetic fleet(s) did not default origin/target zone to 1: ${JSON.stringify(badFleets)}`];
}

//#endregion

//#region main

type LoadFailure =
{
    playerId: number;
    isSynthetic: boolean;
    phase: string;
    message: string;
};

async function main(): Promise<void>
{
    if (existsSync(SOURCE_DATABASE_PATH) === false)
    {
        throw new Error(`Migration safety test: source DB not found at ${SOURCE_DATABASE_PATH}.`);
    }

    cleanupTempArtifacts();

    console.log(`--- Snapshotting source DB: ${SOURCE_DATABASE_PATH} ---`);
    const sourceConnection: Database.Database = new Database(SOURCE_DATABASE_PATH, { readonly: true });
    await sourceConnection.backup(TEMP_DATABASE_PATH);
    sourceConnection.close();

    const syntheticPlayerIds: Set<number> = new Set<number>();

    const injectionConnection: Database.Database = new Database(TEMP_DATABASE_PATH);
    injectionConnection.pragma("foreign_keys = ON");

    const pendingMigrationFilenames: string[] = getPendingMigrationFilenames(injectionConnection);
    if (pendingMigrationFilenames.length === 0)
    {
        // Not every deploy ships a migration. With nothing to migrate the migrate step below is a no-op, so
        // there's no real old->new transition — but we still inject and load every player, which validates
        // the load/resolve path against the current schema. (On dev this warning also reminds you that
        // data/game.db may already be migrated.)
        console.error("⚠️:", `Migration safety test: source DB at ${SOURCE_DATABASE_PATH} has no pending migrations — running load checks anyway (migrate step will be a no-op). On dev, this also means your data/game.db may already be migrated.`);
    }

    console.log(`--- Injecting synthetic pending actions: ${SYNTHETIC_PLAYER_COHORTS.length} players x ${SYNTHETIC_PLANETS_PER_PLAYER} planets, each planet 1 building upgrade + ${SYNTHETIC_ACTIONS_PER_PLANET} ship constructions + ${SYNTHETIC_ACTIONS_PER_PLANET} fleets (${pendingMigrationFilenames.length} pending migration(s)) ---`);
    const injectedPlayerIds: Set<number> = injectSyntheticPlayers(injectionConnection);
    for (const injectedPlayerId of injectedPlayerIds)
    {
        syntheticPlayerIds.add(injectedPlayerId);
    }

    // Snapshot the synthetic rows in their OLD-schema form, before the migration touches anything.
    const beforeSnapshots: TableSnapshot[] = captureSyntheticSnapshot(injectionConnection, syntheticPlayerIds, false);
    injectionConnection.close();

    console.log("--- Running migration against the copy ---");
    runDatabaseScript("db:migrate");
    console.log("--- Running data transfers against the copy ---");
    runDatabaseScript("db:transfer");

    console.log("--- Verifying synthetic values survived the planet rebuild + moon backfill ---");
    const valueFailures: string[] = [];
    const verifyConnection: Database.Database = new Database(TEMP_DATABASE_PATH, { readonly: true });
    const afterSnapshots: TableSnapshot[] = captureSyntheticSnapshot(verifyConnection, syntheticPlayerIds, true);
    for (const snapshotFailure of collectSnapshotValueFailures(beforeSnapshots, afterSnapshots))
    {
        valueFailures.push(snapshotFailure);
    }
    if (areAllMigrationsPending(pendingMigrationFilenames, MOON_BACKFILL_MIGRATION_PREFIXES) === true)
    {
        for (const moonFailure of collectMoonBackfillValueFailures(verifyConnection, syntheticPlayerIds))
        {
            valueFailures.push(moonFailure);
        }
    }
    else
    {
        console.log("--- Skipping moon-backfill check: migrations 018/020 are already applied to the source DB, so they cannot backfill the injected synthetic players ---");
    }
    for (const fleetZoneFailure of collectFleetZoneValueFailures(verifyConnection, syntheticPlayerIds))
    {
        valueFailures.push(fleetZoneFailure);
    }
    verifyConnection.close();

    // Only now is it safe to import the app code: its DB connection is a module-load singleton bound to
    // DATABASE_PATH, which must point at our migrated copy.
    process.env.DATABASE_PATH = TEMP_DATABASE_PATH;
    const ServerType = await import("@/lib/gameplay/coreData/type/serverTypes");
    const ServerProgress = await import("@/lib/gameplay/progressUpdate/server/serverProgress");
    const DB = await import("@/lib/db/db");

    const playerIdConnection: Database.Database = new Database(TEMP_DATABASE_PATH, { readonly: true });
    const playerRows: { id: number }[] = playerIdConnection.prepare("SELECT id FROM player ORDER BY id").all() as { id: number }[];
    playerIdConnection.close();

    console.log(`--- Loading ${playerRows.length} player(s) with new code (before + after completion) ---`);
    const now: number = Date.now();
    const loadFailures: LoadFailure[] = [];

    for (const playerRow of playerRows)
    {
        const isSynthetic: boolean = syntheticPlayerIds.has(playerRow.id);

        // Pass 1: "login before end" — load at real now. Synthetic before-end actions are still pending;
        // synthetic after-end actions resolve here; real players load in whatever state they are in.
        tryLoadPlayer(ServerProgress, ServerType, playerRow.id, now, isSynthetic, "now", loadFailures);

        // Pass 2: "login after end" — push time far forward so every still-pending action resolves. Skip
        // synthetic accounts: their load-only fleet has no real target and is meant to never resolve.
        if (isSynthetic === false)
        {
            tryLoadPlayer(ServerProgress, ServerType, playerRow.id, now + FAR_FUTURE_MS, isSynthetic, "far-future", loadFailures);
        }
    }

    // Release the app's singleton handle before deleting the file (Windows locks open files).
    DB.databaseConnection.close();
    cleanupTempArtifacts();

    reportAndExit(loadFailures, valueFailures, playerRows.length);
}

function runDatabaseScript(scriptName: string): void
{
    execFileSync("pnpm", [scriptName], {
        cwd: PROJECT_ROOT,
        stdio: "inherit",
        shell: true,
        env: { ...process.env, DATABASE_PATH: TEMP_DATABASE_PATH },
    });
}

// Typed loosely on the dynamic imports because their full module types are not in scope at the top level.
function tryLoadPlayer(serverProgress: typeof import("@/lib/gameplay/progressUpdate/server/serverProgress"), serverType: typeof import("@/lib/gameplay/coreData/type/serverTypes"), playerId: number, time: number, isSynthetic: boolean, phase: string, loadFailures: LoadFailure[]): void
{
    try
    {
        const serverData = serverType.getServerData();
        serverProgress.applyPlayerUpdate(playerId, serverData, time);
    }
    catch (error: unknown)
    {
        const message: string = error instanceof Error ? error.message : String(error);
        loadFailures.push({ playerId: playerId, isSynthetic: isSynthetic, phase: phase, message: message });
    }
}

function reportAndExit(loadFailures: LoadFailure[], valueFailures: string[], playerCount: number): void
{
    if (loadFailures.length === 0 && valueFailures.length === 0)
    {
        console.log(`✅ Migration safety test passed: all ${playerCount} player(s) loaded before and after completion, and all synthetic values survived the migration.`);
        process.exit(0);
    }

    if (valueFailures.length > 0)
    {
        console.error("⚠️:", `Migration safety test FAILED — ${valueFailures.length} value-preservation failure(s) (the planet rebuild or backfill shifted/lost/changed data):`);
        for (const valueFailure of valueFailures)
        {
            console.error("⚠️:", valueFailure);
        }
    }

    if (loadFailures.length > 0)
    {
        console.error("⚠️:", `Migration safety test FAILED — ${loadFailures.length} load failure(s):`);
        for (const loadFailure of loadFailures)
        {
            const origin: string = loadFailure.isSynthetic === true
                ? "SYNTHETIC fixture (likely a stale/invalid seed — fix the injection in this test)"
                : "REAL data (a real pending action broke across the migration — this is the bug)";
            console.error("⚠️:", `player ${loadFailure.playerId} [${origin}] phase=${loadFailure.phase}: ${loadFailure.message}`);
        }
    }

    process.exit(1);
}

//#endregion

main().catch((error: unknown): void =>
{
    console.error("⚠️:", error);
    cleanupTempArtifacts();
    process.exit(1);
});
