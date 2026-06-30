import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync, mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

import * as GameType from '@/lib/gameplay/coreData/type/gameTypes';
import * as CoreType from '@/lib/gameplay/coreData/type/coreTypes';
import * as DBType from '@/lib/db/dbTypes';
import * as MessageData from '@/lib/gameplay/dynamicData/player/messageData';
import * as TestDataBuilders from '../helpers/testDataBuilders';

const OUTBOUND_DURATION_MS: number = 600_000;
const PLANET_SIZE: number = 100;
const FLEET_SEED: number = 4242;

let databaseConnection: import('better-sqlite3').Database;
let ServerPlanetManagement: typeof import('@/lib/gameplay/progressUpdate/server/serverPlanetManagement');
let ServerDynamicData: typeof import('@/lib/gameplay/dynamicData/serverDynamicData');
let ServerProgress: typeof import('@/lib/gameplay/progressUpdate/server/serverProgress');
let ServerType: typeof import('@/lib/gameplay/coreData/type/serverTypes');
let temporaryDirectoryPath: string;
let previousDatabasePath: string | undefined;

let nextPlayerId: number = 1;
let nextSystem: number = 1;

beforeAll(async (): Promise<void> =>
{
    temporaryDirectoryPath = mkdtempSync(join(tmpdir(), 'protonet-missile-'));
    previousDatabasePath = process.env.DATABASE_PATH;
    process.env.DATABASE_PATH = join(temporaryDirectoryPath, 'game.db');

    const databaseModule: typeof import('@/lib/db/db') = await import('@/lib/db/db');
    databaseConnection = databaseModule.databaseConnection;

    const schemaSqlText: string = readFileSync(join(process.cwd(), 'db', 'schema.sql'), 'utf-8');
    databaseConnection.exec(schemaSqlText);

    ServerPlanetManagement = await import('@/lib/gameplay/progressUpdate/server/serverPlanetManagement');
    ServerDynamicData = await import('@/lib/gameplay/dynamicData/serverDynamicData');
    ServerProgress = await import('@/lib/gameplay/progressUpdate/server/serverProgress');
    ServerType = await import('@/lib/gameplay/coreData/type/serverTypes');
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

type Body =
{
    planetId: number;
    galaxy: number;
    system: number;
    slot: number;
    zone: GameType.PlanetZone;
};

function createPlayer(): number
{
    const playerId: number = nextPlayerId;
    nextPlayerId += 1;
    databaseConnection.prepare("INSERT INTO users (id, username, password_hash, created_at) VALUES (?, ?, ?, ?)").run(playerId, `missile-user-${playerId}`, 'x', 0);
    databaseConnection.prepare("INSERT INTO player (id, user_id) VALUES (?, ?)").run(playerId, playerId);
    return playerId;
}

function createBody(playerId: number, galaxy: number, system: number, slot: number, zone: GameType.PlanetZone, unitQuantities: Map<GameType.UnitType, number>): Body
{
    const address: GameType.PlanetAddress = { galaxy: galaxy, system: system, slot: slot, zone: zone };
    const planetId: number = ServerPlanetManagement.createZone(address, playerId, PLANET_SIZE, 0, Date.now());
    const dynamicData: CoreType.DynamicPlanetData = { ...structuredClone(CoreType.EmptyPlanetData), unitQuantity: unitQuantities };
    ServerDynamicData.serverUpdateAllPlanetData(planetId, playerId, dynamicData);
    return { planetId: planetId, galaxy: galaxy, system: system, slot: slot, zone: zone };
}

function setResearch(playerId: number, researchType: GameType.ResearchType, level: number): void
{
    databaseConnection.prepare(
        `INSERT INTO player_research (player_id, research_type, research_level) VALUES (?, ?, ?)
         ON CONFLICT (player_id, research_type) DO UPDATE SET research_level = excluded.research_level`
    ).run(playerId, researchType, level);
}

function persistMissileFleet(attackerPlayerId: number, attackerOrigin: Body, target: Body, targetOwnerId: number | null, missileCount: number, unitFocus: GameType.UnitType | null): void
{
    const startedAt: number = Date.now() - OUTBOUND_DURATION_MS - 1_000;
    const fleetMovement: CoreType.FleetMovement = TestDataBuilders.buildFleetMovement(
    {
        fleetMovementRow:
        {
            id: -1,
            seed: FLEET_SEED,
            player_origin_id: attackerPlayerId,
            planet_origin_id: attackerOrigin.planetId,
            planet_origin_zone: attackerOrigin.zone,
            planet_origin_slot: attackerOrigin.slot,
            planet_origin_system: attackerOrigin.system,
            planet_origin_galaxy: attackerOrigin.galaxy,
            player_target_id: targetOwnerId,
            planet_target_zone: target.zone,
            planet_target_slot: target.slot,
            planet_target_system: target.system,
            planet_target_galaxy: target.galaxy,
            is_return_trip: 0,
            fleet_action_type: GameType.FleetActionType.MissileLaunch,
            requested_at: startedAt,
            duration_at_request_time: OUTBOUND_DURATION_MS,
            duration_at_start_time: OUTBOUND_DURATION_MS,
            started_at: startedAt,
            unit_focus: unitFocus,
        },
        fleetMovementUnitRows: [TestDataBuilders.buildFleetMovementUnitRow({ unit_type: GameType.UnitType.InterplanetaryMissile, unit_quantity: missileCount })],
        fleetMovementResourceRows: [],
        fleetMovementFuelRows: [],
    });

    const originDynamicData: CoreType.DynamicPlanetData = { ...structuredClone(CoreType.EmptyPlanetData), futureFleetArrivals: [fleetMovement] };
    ServerDynamicData.serverUpdatePlanetDataContext(attackerOrigin.planetId, attackerPlayerId, CoreType.DataContext.FutureFleetArrivals, originDynamicData);
}

function resolve(attackerPlayerId: number): void
{
    ServerProgress.applyPlayerUpdate(attackerPlayerId, ServerType.getServerData(), Date.now());
}

function unitCount(planetId: number, unitType: GameType.UnitType): number
{
    const dynamicData: CoreType.DynamicPlanetData = ServerDynamicData.getDynamicPlanetData(planetId);
    return dynamicData.unitQuantity.get(unitType) ?? 0;
}

function messagesFor(playerId: number): DBType.MessageRow[]
{
    return databaseConnection.prepare(
        "SELECT id, player_id, received_at, type, is_read, title, body FROM message WHERE player_id = ? ORDER BY id ASC"
    ).all(playerId) as DBType.MessageRow[];
}

type AttackScenario =
{
    attackerPlayerId: number;
    victimPlayerId: number;
    attackerOrigin: Body;
    victimPlanet: Body;
    system: number;
};

function setupAttack(victimUnits: Map<GameType.UnitType, number>): AttackScenario
{
    const system: number = nextSystem;
    nextSystem += 1;

    const attackerPlayerId: number = createPlayer();
    const victimPlayerId: number = createPlayer();
    const attackerOrigin: Body = createBody(attackerPlayerId, 1, system, 3, GameType.PlanetZone.Planet, new Map<GameType.UnitType, number>());
    const victimPlanet: Body = createBody(victimPlayerId, 1, system, 8, GameType.PlanetZone.Planet, victimUnits);

    return { attackerPlayerId: attackerPlayerId, victimPlayerId: victimPlayerId, attackerOrigin: attackerOrigin, victimPlanet: victimPlanet, system: system };
}

describe('missile launch resolution', () =>
{
    it('destroys defenses and reports to both attacker and victim, leaving no return fleet', () =>
    {
        const scenario: AttackScenario = setupAttack(new Map<GameType.UnitType, number>([[GameType.UnitType.RocketLauncher, 5]]));
        persistMissileFleet(scenario.attackerPlayerId, scenario.attackerOrigin, scenario.victimPlanet, scenario.victimPlayerId, 5, null);

        resolve(scenario.attackerPlayerId);

        expect(unitCount(scenario.victimPlanet.planetId, GameType.UnitType.RocketLauncher)).toBe(0);
        expect(ServerDynamicData.getDynamicPlanetFutureFleetArrivalData(scenario.attackerOrigin.planetId).length).toBe(0);

        const attackerMessages: DBType.MessageRow[] = messagesFor(scenario.attackerPlayerId);
        const victimMessages: DBType.MessageRow[] = messagesFor(scenario.victimPlayerId);
        expect(attackerMessages.length).toBe(1);
        expect(attackerMessages[0].type).toBe(MessageData.MessageType.MissileReport);
        expect(attackerMessages[0].body).toContain("5 Rocket Launcher");
        expect(victimMessages.length).toBe(1);
        expect(victimMessages[0].body).toContain("Rocket Launcher");
    });

    it('intercepts incoming missiles 1:1 with the planet interceptors and consumes them', () =>
    {
        const scenario: AttackScenario = setupAttack(new Map<GameType.UnitType, number>([[GameType.UnitType.RocketLauncher, 5], [GameType.UnitType.InterceptorMissile, 3]]));
        persistMissileFleet(scenario.attackerPlayerId, scenario.attackerOrigin, scenario.victimPlanet, scenario.victimPlayerId, 5, null);

        resolve(scenario.attackerPlayerId);

        expect(unitCount(scenario.victimPlanet.planetId, GameType.UnitType.InterceptorMissile)).toBe(0);
        expect(unitCount(scenario.victimPlanet.planetId, GameType.UnitType.RocketLauncher)).toBe(3);
        expect(messagesFor(scenario.attackerPlayerId)[0].body).toContain("Intercepted by anti-ballistic missiles: 3");
    });

    it('higher armour research lets the defender keep more defenses than no armour research', () =>
    {
        const lowArmour: AttackScenario = setupAttack(new Map<GameType.UnitType, number>([[GameType.UnitType.RocketLauncher, 8]]));
        setResearch(lowArmour.victimPlayerId, GameType.ResearchType.ArmourTech, 0);
        persistMissileFleet(lowArmour.attackerPlayerId, lowArmour.attackerOrigin, lowArmour.victimPlanet, lowArmour.victimPlayerId, 10, null);
        resolve(lowArmour.attackerPlayerId);
        const lowArmourSurvivors: number = unitCount(lowArmour.victimPlanet.planetId, GameType.UnitType.RocketLauncher);

        const highArmour: AttackScenario = setupAttack(new Map<GameType.UnitType, number>([[GameType.UnitType.RocketLauncher, 8]]));
        setResearch(highArmour.victimPlayerId, GameType.ResearchType.ArmourTech, 60);
        persistMissileFleet(highArmour.attackerPlayerId, highArmour.attackerOrigin, highArmour.victimPlanet, highArmour.victimPlayerId, 10, null);
        resolve(highArmour.attackerPlayerId);
        const highArmourSurvivors: number = unitCount(highArmour.victimPlanet.planetId, GameType.UnitType.RocketLauncher);

        expect(highArmourSurvivors).toBeGreaterThan(lowArmourSurvivors);
    });

    it('higher weapon research destroys at least as many defenses against a tough armour wall', () =>
    {
        const lowWeapon: AttackScenario = setupAttack(new Map<GameType.UnitType, number>([[GameType.UnitType.RocketLauncher, 8]]));
        setResearch(lowWeapon.victimPlayerId, GameType.ResearchType.ArmourTech, 60);
        persistMissileFleet(lowWeapon.attackerPlayerId, lowWeapon.attackerOrigin, lowWeapon.victimPlanet, lowWeapon.victimPlayerId, 10, null);
        resolve(lowWeapon.attackerPlayerId);
        const lowWeaponDestroyed: number = 8 - unitCount(lowWeapon.victimPlanet.planetId, GameType.UnitType.RocketLauncher);

        const highWeapon: AttackScenario = setupAttack(new Map<GameType.UnitType, number>([[GameType.UnitType.RocketLauncher, 8]]));
        setResearch(highWeapon.victimPlayerId, GameType.ResearchType.ArmourTech, 60);
        setResearch(highWeapon.attackerPlayerId, GameType.ResearchType.WeaponTech, 10);
        persistMissileFleet(highWeapon.attackerPlayerId, highWeapon.attackerOrigin, highWeapon.victimPlanet, highWeapon.victimPlayerId, 10, null);
        resolve(highWeapon.attackerPlayerId);
        const highWeaponDestroyed: number = 8 - unitCount(highWeapon.victimPlanet.planetId, GameType.UnitType.RocketLauncher);

        expect(highWeaponDestroyed).toBeGreaterThan(lowWeaponDestroyed);
    });

    it('shielding research has no effect on missile combat (shields are ignored)', () =>
    {
        const noShield: AttackScenario = setupAttack(new Map<GameType.UnitType, number>([[GameType.UnitType.RocketLauncher, 8]]));
        setResearch(noShield.victimPlayerId, GameType.ResearchType.ArmourTech, 60);
        persistMissileFleet(noShield.attackerPlayerId, noShield.attackerOrigin, noShield.victimPlanet, noShield.victimPlayerId, 10, null);
        resolve(noShield.attackerPlayerId);
        const noShieldSurvivors: number = unitCount(noShield.victimPlanet.planetId, GameType.UnitType.RocketLauncher);

        const highShield: AttackScenario = setupAttack(new Map<GameType.UnitType, number>([[GameType.UnitType.RocketLauncher, 8]]));
        setResearch(highShield.victimPlayerId, GameType.ResearchType.ArmourTech, 60);
        setResearch(highShield.victimPlayerId, GameType.ResearchType.ShieldingTech, 20);
        persistMissileFleet(highShield.attackerPlayerId, highShield.attackerOrigin, highShield.victimPlanet, highShield.victimPlayerId, 10, null);
        resolve(highShield.attackerPlayerId);
        const highShieldSurvivors: number = unitCount(highShield.victimPlanet.planetId, GameType.UnitType.RocketLauncher);

        expect(highShieldSurvivors).toBe(noShieldSurvivors);
    });

    it('destroys stored enemy missiles at 8 per surviving missile once no defenses remain', () =>
    {
        const scenario: AttackScenario = setupAttack(new Map<GameType.UnitType, number>([[GameType.UnitType.InterplanetaryMissile, 20]]));
        persistMissileFleet(scenario.attackerPlayerId, scenario.attackerOrigin, scenario.victimPlanet, scenario.victimPlayerId, 2, null);

        resolve(scenario.attackerPlayerId);

        expect(unitCount(scenario.victimPlanet.planetId, GameType.UnitType.InterplanetaryMissile)).toBe(4);
        expect(messagesFor(scenario.attackerPlayerId)[0].body).toContain("Stored missiles destroyed: 16");
    });

    it('missiles aimed at a missing target die in deep space and never return', () =>
    {
        const system: number = nextSystem;
        nextSystem += 1;
        const attackerPlayerId: number = createPlayer();
        const attackerOrigin: Body = createBody(attackerPlayerId, 1, system, 3, GameType.PlanetZone.Planet, new Map<GameType.UnitType, number>());
        const emptyTarget: Body = { planetId: -1, galaxy: 1, system: system, slot: 9, zone: GameType.PlanetZone.Planet };

        persistMissileFleet(attackerPlayerId, attackerOrigin, emptyTarget, null, 3, null);
        resolve(attackerPlayerId);

        expect(ServerDynamicData.getDynamicPlanetFutureFleetArrivalData(attackerOrigin.planetId).length).toBe(0);
        const attackerMessages: DBType.MessageRow[] = messagesFor(attackerPlayerId);
        expect(attackerMessages.length).toBe(1);
        expect(attackerMessages[0].body).toMatch(/deep space/i);
    });

    it('a moon target is shielded by the planet interceptors, which are consumed on the planet', () =>
    {
        const system: number = nextSystem;
        nextSystem += 1;
        const attackerPlayerId: number = createPlayer();
        const victimPlayerId: number = createPlayer();
        const attackerOrigin: Body = createBody(attackerPlayerId, 1, system, 3, GameType.PlanetZone.Planet, new Map<GameType.UnitType, number>());
        const victimPlanet: Body = createBody(victimPlayerId, 1, system, 8, GameType.PlanetZone.Planet, new Map<GameType.UnitType, number>([[GameType.UnitType.InterceptorMissile, 2]]));
        const victimMoon: Body = createBody(victimPlayerId, 1, system, 8, GameType.PlanetZone.Moon, new Map<GameType.UnitType, number>([[GameType.UnitType.RocketLauncher, 5]]));

        persistMissileFleet(attackerPlayerId, attackerOrigin, victimMoon, victimPlayerId, 5, null);
        resolve(attackerPlayerId);

        expect(unitCount(victimPlanet.planetId, GameType.UnitType.InterceptorMissile)).toBe(0);
        expect(unitCount(victimMoon.planetId, GameType.UnitType.RocketLauncher)).toBe(2);
    });
});
