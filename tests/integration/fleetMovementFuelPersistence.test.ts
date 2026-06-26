import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync, mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

import * as GameType from '@/lib/gameplay/coreData/type/gameTypes';
import * as CoreType from '@/lib/gameplay/coreData/type/coreTypes';
import * as DBType from '@/lib/db/dbTypes';
import * as UnitFuelConsumption from '@/lib/gameplay/coreData/formula/unitFuelConsumptionFormulas';
import * as TestDataBuilders from '../helpers/testDataBuilders';

// What this covers: a fleet send computes fuel, then writes the whole movement to the DB — including
// the fleet_movement_fuel rows added by migration 016. The pure formula tests
// (unitFuelConsumptionFormulas.test.ts) prove the *number* is right; this proves that number reaches
// the DB intact alongside the unit and resource rows, and survives the read-back getter.
//
// It drives the real server persistence path (ServerDynamicData.serverUpdatePlanetDataContext →
// updateFutureFleetArrivals) against a throwaway on-disk SQLite DB. That path uses the app's singleton
// connection (lib/db/db), so DATABASE_PATH is repointed at a temp file BEFORE that module is imported:
// every app module that touches the DB is loaded dynamically in beforeAll, and only DB-free modules
// (types, the pure fuel formula, builders) are imported statically up top.

// A fixed speed (matching the pure unitFuelConsumptionFormulas.test.ts fixture) keeps the persisted
// number deterministic; the persistence path is identical whatever a live send's speed factor is.
const FLEET_SPEED: number = 10;

const PLAYER_ID: number = 1;

let databaseConnection: import('better-sqlite3').Database;
let ServerDynamicData: typeof import('@/lib/gameplay/dynamicData/serverDynamicData');
let temporaryDirectoryPath: string;
let previousDatabasePath: string | undefined;

beforeAll(async (): Promise<void> =>
{
    temporaryDirectoryPath = mkdtempSync(join(tmpdir(), 'protonet-fuel-'));
    previousDatabasePath = process.env.DATABASE_PATH;
    process.env.DATABASE_PATH = join(temporaryDirectoryPath, 'game.db');

    // Imported only now, after DATABASE_PATH points at the temp file, so the singleton connection opens
    // against the throwaway DB instead of the real data/game.db.
    const databaseModule: typeof import('@/lib/db/db') = await import('@/lib/db/db');
    databaseConnection = databaseModule.databaseConnection;

    const schemaSqlText: string = readFileSync(join(process.cwd(), 'db', 'schema.sql'), 'utf-8');
    databaseConnection.exec(schemaSqlText);

    // fleet_movement.player_origin_id is a foreign key onto player(id), which in turn needs a user.
    // planet_origin_id has no foreign key, so the origin planet does not need a row of its own.
    databaseConnection.prepare(
        "INSERT INTO users (id, username, password_hash, created_at) VALUES (?, ?, ?, ?)"
    ).run(PLAYER_ID, 'fuel-test-user', 'x', 0);
    databaseConnection.prepare(
        "INSERT INTO player (id, user_id) VALUES (?, ?)"
    ).run(PLAYER_ID, PLAYER_ID);

    ServerDynamicData = await import('@/lib/gameplay/dynamicData/serverDynamicData');
});

afterAll((): void =>
{
    databaseConnection.close();
    rmSync(temporaryDirectoryPath, { recursive: true, force: true });

    if (previousDatabasePath === undefined)
    {
        delete process.env.DATABASE_PATH;
    }
    else
    {
        process.env.DATABASE_PATH = previousDatabasePath;
    }
});

function computeFuel(unitQuantities: Map<GameType.UnitType, number>, distance: number): Map<GameType.ResourceType, number>
{
    const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData();
    const serverData: CoreType.ServerData = TestDataBuilders.buildServerData();

    return UnitFuelConsumption.computeFuelConsumption(playerData, unitQuantities, distance, FLEET_SPEED, serverData);
}

function buildFuelRows(fuelRequirements: Map<GameType.ResourceType, number>): DBType.FleetMovementFuelRow[]
{
    const fuelRows: DBType.FleetMovementFuelRow[] = [];
    for (const [resourceType, resourceQuantity] of fuelRequirements)
    {
        const fuelRow: DBType.FleetMovementFuelRow =
        {
            fleet_id: -1,
            resource_type: resourceType,
            resource_quantity: resourceQuantity,
        };
        fuelRows.push(fuelRow);
    }

    return fuelRows;
}

// Builds the movement exactly the way trySendFleetLogic does (unit rows from the fleet, fuel rows from
// the computed consumption, transported-resource rows), then persists it through the real server path
// and returns the row id the DB assigned.
function persistFleetMovement(planetOriginId: number, unitQuantities: Map<GameType.UnitType, number>, fuelRequirements: Map<GameType.ResourceType, number>, transportedResources: Map<GameType.ResourceType, number>): number
{
    const fleetMovementUnitRows: DBType.FleetMovementUnitRow[] = [];
    for (const [unitType, unitQuantity] of unitQuantities)
    {
        fleetMovementUnitRows.push(TestDataBuilders.buildFleetMovementUnitRow({ unit_type: unitType, unit_quantity: unitQuantity }));
    }

    const fleetMovementResourceRows: DBType.FleetMovementResourceRow[] = [];
    for (const [resourceType, resourceQuantity] of transportedResources)
    {
        fleetMovementResourceRows.push(TestDataBuilders.buildFleetMovementResourceRow({ resource_type: resourceType, resource_quantity: resourceQuantity }));
    }

    const fleetMovement: CoreType.FleetMovement = TestDataBuilders.buildFleetMovement(
    {
        fleetMovementRow:
        {
            id: -1,
            seed: 12345,
            player_origin_id: PLAYER_ID,
            planet_origin_id: planetOriginId,
            fleet_action_type: GameType.FleetActionType.Station,
        },
        fleetMovementUnitRows: fleetMovementUnitRows,
        fleetMovementResourceRows: fleetMovementResourceRows,
        fleetMovementFuelRows: buildFuelRows(fuelRequirements),
    });

    const dynamicPlanetData: CoreType.DynamicPlanetData = TestDataBuilders.buildDynamicPlanetData({ futureFleetArrivals: [fleetMovement] });
    ServerDynamicData.serverUpdatePlanetDataContext(planetOriginId, PLAYER_ID, CoreType.DataContext.FutureFleetArrivals, dynamicPlanetData);

    return fleetMovement.fleetMovementRow.id;
}

type FuelRow = { resource_type: number; resource_quantity: number };
type UnitRow = { unit_type: number; unit_quantity: number };
type ResourceRow = { resource_type: number; resource_quantity: number };

function readFuelRows(fleetId: number): FuelRow[]
{
    return databaseConnection.prepare(
        "SELECT resource_type, resource_quantity FROM fleet_movement_fuel WHERE fleet_id = ? ORDER BY resource_type"
    ).all(fleetId) as FuelRow[];
}

function readUnitRows(fleetId: number): UnitRow[]
{
    return databaseConnection.prepare(
        "SELECT unit_type, unit_quantity FROM fleet_movement_unit WHERE fleet_id = ? ORDER BY unit_type"
    ).all(fleetId) as UnitRow[];
}

function readResourceRows(fleetId: number): ResourceRow[]
{
    return databaseConnection.prepare(
        "SELECT resource_type, resource_quantity FROM fleet_movement_resource WHERE fleet_id = ? ORDER BY resource_type"
    ).all(fleetId) as ResourceRow[];
}

describe('fleet movement persistence — fuel rows', () =>
{
    it('writes the computed deuterium as a fleet_movement_fuel row (13 for one Small Transport over 35000)', () =>
    {
        const planetOriginId: number = 101;
        const unitQuantities: Map<GameType.UnitType, number> = new Map([[GameType.UnitType.SmallTransport, 1]]);
        const fuelRequirements: Map<GameType.ResourceType, number> = computeFuel(unitQuantities, 35_000);

        // Pin to the same exact amount the pure formula test asserts, so a regression in either layer is caught.
        expect(fuelRequirements.get(GameType.ResourceType.Deuterium)).toBe(13);

        const fleetId: number = persistFleetMovement(planetOriginId, unitQuantities, fuelRequirements, new Map());

        const fuelRows: FuelRow[] = readFuelRows(fleetId);
        expect(fuelRows).toEqual([{ resource_type: GameType.ResourceType.Deuterium, resource_quantity: 13 }]);
    });

    it('writes the unit, fuel, and transported-resource rows together and reads them back through the getter', () =>
    {
        const planetOriginId: number = 102;
        const unitQuantities: Map<GameType.UnitType, number> = new Map([[GameType.UnitType.SmallTransport, 2]]);
        const fuelRequirements: Map<GameType.ResourceType, number> = computeFuel(unitQuantities, 35_000);
        const transportedResources: Map<GameType.ResourceType, number> = new Map([[GameType.ResourceType.Metal, 500]]);

        const fleetId: number = persistFleetMovement(planetOriginId, unitQuantities, fuelRequirements, transportedResources);

        // Raw rows: units and transported resources land in their own tables, distinct from fuel.
        expect(readUnitRows(fleetId)).toEqual([{ unit_type: GameType.UnitType.SmallTransport, unit_quantity: 2 }]);
        expect(readResourceRows(fleetId)).toEqual([{ resource_type: GameType.ResourceType.Metal, resource_quantity: 500 }]);

        const expectedDeuterium: number = fuelRequirements.get(GameType.ResourceType.Deuterium)!;
        expect(readFuelRows(fleetId)).toEqual([{ resource_type: GameType.ResourceType.Deuterium, resource_quantity: expectedDeuterium }]);

        // The read path (getDynamicPlanetFutureFleetArrivalData) must hydrate the fuel rows too — the
        // regression guard for migration 016 being wired into the getter, not just the writer.
        const loaded: CoreType.FleetMovement[] = ServerDynamicData.getDynamicPlanetFutureFleetArrivalData(planetOriginId);
        const loadedFleet: CoreType.FleetMovement | undefined = loaded.find((fleet: CoreType.FleetMovement): boolean => fleet.fleetMovementRow.id === fleetId);
        expect(loadedFleet).toBeDefined();
        expect(loadedFleet!.fleetMovementFuelRows).toEqual([{ fleet_id: fleetId, resource_type: GameType.ResourceType.Deuterium, resource_quantity: expectedDeuterium }]);
        expect(loadedFleet!.fleetMovementUnitRows).toHaveLength(1);
        expect(loadedFleet!.fleetMovementUnitRows[0]!.unit_quantity).toBe(2);
    });

    it('replaces the prior movement on a re-send, leaving no orphaned fuel rows', () =>
    {
        const planetOriginId: number = 103;
        const unitQuantities: Map<GameType.UnitType, number> = new Map([[GameType.UnitType.SmallTransport, 1]]);

        const firstFuel: Map<GameType.ResourceType, number> = computeFuel(unitQuantities, 35_000);
        const firstFleetId: number = persistFleetMovement(planetOriginId, unitQuantities, firstFuel, new Map());
        expect(readFuelRows(firstFleetId)).toHaveLength(1);

        // A second send from the same origin DELETEs the prior fleet_movement row; the fuel/unit/resource
        // children must cascade away with it (fleet_movement_fuel is the newest child table — this proves
        // it is on the cascade).
        const secondFuel: Map<GameType.ResourceType, number> = computeFuel(unitQuantities, 70_000);
        const secondFleetId: number = persistFleetMovement(planetOriginId, unitQuantities, secondFuel, new Map());

        expect(readFuelRows(firstFleetId)).toHaveLength(0);
        expect(readFuelRows(secondFleetId)).toHaveLength(1);

        const totalFuelRowsForOrigin: { count: number } = databaseConnection.prepare(
            "SELECT COUNT(*) AS count FROM fleet_movement_fuel WHERE fleet_id IN (SELECT id FROM fleet_movement WHERE planet_origin_id = ?)"
        ).get(planetOriginId) as { count: number };
        expect(totalFuelRowsForOrigin.count).toBe(1);
    });
});
