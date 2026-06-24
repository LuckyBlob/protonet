import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join } from 'path';

import * as GameType from '@/lib/gameplay/coreData/type/gameTypes';

// Migration 020 backfills a moon (zone=2) on each owner's two oldest zone=1 planets, idempotently.
// It is a pure INSERT (the planet table already has the zone column post-018), so it can be applied
// directly to a schema.sql DB seeded with planets/moons.

const SCHEMA_SQL: string = readFileSync(join(process.cwd(), 'db', 'schema.sql'), 'utf-8');
const MIGRATION_020_SQL: string = readFileSync(join(process.cwd(), 'db', 'migrations', '020_backfill_second_planet_moon.sql'), 'utf-8');

let databaseConnection: Database.Database;

beforeEach((): void =>
{
    databaseConnection = new Database(':memory:');
    databaseConnection.exec(SCHEMA_SQL);
});

afterEach((): void =>
{
    databaseConnection.close();
});

function insertPlayer(playerId: number): void
{
    databaseConnection.prepare("INSERT INTO users (id, username, password_hash, created_at) VALUES (?, ?, ?, ?)").run(playerId, `mig-user-${playerId}`, 'x', 0);
    databaseConnection.prepare("INSERT INTO player (id, user_id) VALUES (?, ?)").run(playerId, playerId);
}

function insertZone(playerId: number, slot: number, zone: GameType.PlanetZone, claimedAt: number): void
{
    databaseConnection.prepare(
        "INSERT INTO planet (zone, slot, system, galaxy, size, owner_player_id, claimed_at, last_updated) VALUES (?, ?, 1, 1, 100, ?, ?, ?)"
    ).run(zone, slot, playerId, claimedAt, claimedAt);
}

function countMoonsAtSlot(slot: number): number
{
    const row: { count: number } = databaseConnection.prepare(
        "SELECT COUNT(*) AS count FROM planet WHERE slot = ? AND zone = ?"
    ).get(slot, GameType.PlanetZone.Moon) as { count: number };
    return row.count;
}

describe('migration 020: backfill second-planet moon', () =>
{
    it('adds a moon to the second planet while leaving the first planet untouched', () =>
    {
        insertPlayer(1);
        insertZone(1, 4, GameType.PlanetZone.Planet, 100);
        insertZone(1, 4, GameType.PlanetZone.Moon, 100); // first planet already moon-ed by 018
        insertZone(1, 6, GameType.PlanetZone.Planet, 200); // second planet, no moon yet

        databaseConnection.exec(MIGRATION_020_SQL);

        expect(countMoonsAtSlot(4)).toBe(1); // first planet's moon not duplicated
        expect(countMoonsAtSlot(6)).toBe(1); // second planet gained a moon
    });

    it('is idempotent — re-running adds nothing', () =>
    {
        insertPlayer(1);
        insertZone(1, 4, GameType.PlanetZone.Planet, 100);
        insertZone(1, 4, GameType.PlanetZone.Moon, 100);
        insertZone(1, 6, GameType.PlanetZone.Planet, 200);

        databaseConnection.exec(MIGRATION_020_SQL);
        databaseConnection.exec(MIGRATION_020_SQL);

        expect(countMoonsAtSlot(4)).toBe(1);
        expect(countMoonsAtSlot(6)).toBe(1);
    });

    it('only moons the two OLDEST planets, not a third colonized one', () =>
    {
        insertPlayer(1);
        insertZone(1, 4, GameType.PlanetZone.Planet, 100);
        insertZone(1, 6, GameType.PlanetZone.Planet, 200);
        insertZone(1, 8, GameType.PlanetZone.Planet, 300); // later colonized — should stay moon-less

        databaseConnection.exec(MIGRATION_020_SQL);

        expect(countMoonsAtSlot(4)).toBe(1);
        expect(countMoonsAtSlot(6)).toBe(1);
        expect(countMoonsAtSlot(8)).toBe(0);
    });

    it('copies the planet coords/owner/size onto the backfilled moon', () =>
    {
        insertPlayer(1);
        insertZone(1, 6, GameType.PlanetZone.Planet, 200);

        databaseConnection.exec(MIGRATION_020_SQL);

        const moonRow: { slot: number; system: number; galaxy: number; size: number; owner_player_id: number } | undefined =
            databaseConnection.prepare("SELECT slot, system, galaxy, size, owner_player_id FROM planet WHERE slot = 6 AND zone = ?").get(GameType.PlanetZone.Moon) as any;

        expect(moonRow).toBeDefined();
        expect(moonRow!.system).toBe(1);
        expect(moonRow!.galaxy).toBe(1);
        expect(moonRow!.size).toBe(100);
        expect(moonRow!.owner_player_id).toBe(1);
    });
});
