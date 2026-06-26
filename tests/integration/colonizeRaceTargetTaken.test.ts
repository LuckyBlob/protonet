import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync, mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

import * as GameType from '@/lib/gameplay/coreData/type/gameTypes';
import * as CoreType from '@/lib/gameplay/coreData/type/coreTypes';
import * as TestDataBuilders from '../helpers/testDataBuilders';

// Colonize self-handles the race where a vacant target slot is claimed before the fleet arrives:
// resolveColonizeAction checks addressIsTaken (a DB read) and bounces the fleet home with an
// "already claimed" report instead of throwing. This is why claimPlanet needs no inbound-fleet
// cleanup of its own. DB modules are imported only after DATABASE_PATH is repointed.

let databaseConnection: import('better-sqlite3').Database;
let ColonizeAction: typeof import('@/lib/gameplay/dynamicData/planet/fleet/colonizeAction');
let temporaryDirectoryPath: string;
let previousDatabasePath: string | undefined;

beforeAll(async (): Promise<void> =>
{
    temporaryDirectoryPath = mkdtempSync(join(tmpdir(), 'protonet-colonize-'));
    previousDatabasePath = process.env.DATABASE_PATH;
    process.env.DATABASE_PATH = join(temporaryDirectoryPath, 'game.db');

    const databaseModule: typeof import('@/lib/db/db') = await import('@/lib/db/db');
    databaseConnection = databaseModule.databaseConnection;

    const schemaSqlText: string = readFileSync(join(process.cwd(), 'db', 'schema.sql'), 'utf-8');
    databaseConnection.exec(schemaSqlText);

    ColonizeAction = await import('@/lib/gameplay/dynamicData/planet/fleet/colonizeAction');
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

describe('colonize to a slot taken before arrival', () =>
{
    it('bounces home with an "already claimed" report instead of throwing', () =>
    {
        // Another player already owns the target slot (1:1:6) at arrival.
        databaseConnection.prepare("INSERT INTO users (id, username, password_hash, created_at) VALUES (2, 'rival', 'x', 0)").run();
        databaseConnection.prepare("INSERT INTO player (id, user_id) VALUES (2, 2)").run();
        databaseConnection.prepare(
            "INSERT INTO planet (zone, slot, system, galaxy, size, owner_player_id, claimed_at, last_updated) VALUES (?, 6, 1, 1, 100, 2, 0, 0)"
        ).run(GameType.PlanetZone.Planet);

        const originPlanet: CoreType.PlanetData = TestDataBuilders.buildPlanetData({ planetRow: { id: 1, slot: 4, system: 1, galaxy: 1 } });
        const originPlayer: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ playerRow: { id: 1 }, planetDatas: [originPlanet] });

        const fleet: CoreType.FleetMovement = TestDataBuilders.buildFleetMovement(
        {
            fleetMovementRow:
            {
                id: 50,
                player_origin_id: 1,
                planet_origin_id: 1,
                player_target_id: null,
                planet_target_zone: GameType.PlanetZone.Planet,
                planet_target_slot: 6,
                planet_target_system: 1,
                planet_target_galaxy: 1,
                fleet_action_type: GameType.FleetActionType.Colonize,
                started_at: 1_000_000,
                duration_at_start_time: 60_000,
            },
            fleetMovementUnitRows: [TestDataBuilders.buildFleetMovementUnitRow({ fleet_id: 50, unit_type: GameType.UnitType.ColonyShip, unit_quantity: 1 })],
        });

        ColonizeAction.resolveColonizeAction(originPlayer, fleet, TestDataBuilders.buildServerData());

        expect(fleet.resolutionState).toBe(CoreType.FleetMovementResolution.Resolved);
        expect(fleet.fleetMovementRow.is_return_trip).toBe(1);
        expect(fleet.originMessageRow?.body).toContain('already claimed');
    });
});
