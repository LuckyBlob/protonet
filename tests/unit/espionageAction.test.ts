import { describe, it, expect } from 'vitest';
import * as EspionageAction from '@/lib/gameplay/dynamicData/planet/fleet/espionageAction';
import * as CoreType from '@/lib/gameplay/coreData/type/coreTypes';
import * as GameType from '@/lib/gameplay/coreData/type/gameTypes';
import * as MessageData from '@/lib/gameplay/dynamicData/player/messageData';
import * as TestDataBuilders from '../helpers/testDataBuilders';

const ORIGIN_PLAYER_ID: number = 1;
const TARGET_PLAYER_ID: number = 2;
const ORIGIN_PLANET_ID: number = 1;
const TARGET_PLANET_ID: number = 2;

// The target planet below carries 3 units, so with 10 probes and equal tech the detection chance is
// 1 * 10 * 3 * 0.25% = 0.075. seededRandom(7) ≈ 0.012 sits below that (probes detected); seededRandom(2)
// ≈ 0.734 sits above every chance used here (probes escape).
const DETECTED_SEED: number = 7;
const ESCAPED_SEED: number = 2;

type SetupResult =
{
    fleet: CoreType.FleetMovement,
    originPlanet: CoreType.PlanetData,
    targetPlanet: CoreType.PlanetData,
    originPlayer: CoreType.PlayerData,
    targetPlayer: CoreType.PlayerData,
};

type SetupOptions =
{
    targetZone?: GameType.PlanetZone,
    attackerEspionageTech?: number,
    defenderEspionageTech?: number,
};

function setup(probeCount: number, seed: number, options: SetupOptions = {}): SetupResult
{
    const targetZone: GameType.PlanetZone = options.targetZone ?? GameType.PlanetZone.Planet;
    const attackerEspionageTech: number = options.attackerEspionageTech ?? 0;
    const defenderEspionageTech: number = options.defenderEspionageTech ?? 0;

    const fleet: CoreType.FleetMovement = TestDataBuilders.buildFleetMovement(
    {
        fleetMovementRow:
        {
            id: 1,
            seed: seed,
            player_origin_id: ORIGIN_PLAYER_ID,
            planet_origin_id: ORIGIN_PLANET_ID,
            player_target_id: TARGET_PLAYER_ID,
            planet_origin_galaxy: 1, planet_origin_system: 1, planet_origin_slot: 3,
            planet_target_galaxy: 1, planet_target_system: 1, planet_target_slot: 4, planet_target_zone: targetZone,
            fleet_action_type: GameType.FleetActionType.Espionage,
            started_at: 1_000_000,
            duration_at_start_time: 30_000,
        },
        fleetMovementUnitRows: [TestDataBuilders.buildFleetMovementUnitRow({ fleet_id: 1, unit_type: GameType.UnitType.EspionageProbe, unit_quantity: probeCount })],
    });

    const originFleet: CoreType.FleetMovement = TestDataBuilders.buildFleetMovement({ fleetMovementRow: { id: 1 } });
    const originPlanet: CoreType.PlanetData = TestDataBuilders.buildPlanetData(
    {
        planetRow: { id: ORIGIN_PLANET_ID },
        dynamicPlanetData: { futureFleetArrivals: [originFleet] },
    });

    const targetFleet: CoreType.FleetMovement = TestDataBuilders.buildFleetMovement({ fleetMovementRow: { id: 1 } });
    const targetPlanet: CoreType.PlanetData = TestDataBuilders.buildPlanetData(
    {
        planetRow: { id: TARGET_PLANET_ID, slot: 4, zone: targetZone },
        dynamicPlanetData:
        {
            resourceQuantity: new Map<GameType.ResourceType, number>([[GameType.ResourceType.Metal, 1234]]),
            unitQuantity: new Map<GameType.UnitType, number>([[GameType.UnitType.SmallTransport, 3]]),
            buildingLevels: new Map<GameType.BuildingType, number>([[GameType.BuildingType.MetalMine, 7]]),
            futureFleetArrivals: [targetFleet],
        },
    });

    const originDynamicPlayerData: CoreType.DynamicPlayerData = TestDataBuilders.buildDynamicPlayerData(
    {
        researchLevels: new Map<GameType.ResearchType, number>([[GameType.ResearchType.EspionageTech, attackerEspionageTech]]),
    });
    const originPlayer: CoreType.PlayerData = TestDataBuilders.buildPlayerData(
    {
        playerRow: { id: ORIGIN_PLAYER_ID },
        dynamicPlayerData: originDynamicPlayerData,
        planetDatas: [originPlanet],
    });
    originPlayer.publicPlayerDatas = [TestDataBuilders.buildPublicPlayerData({ id: TARGET_PLAYER_ID, username: "Victim" })];

    const targetDynamicPlayerData: CoreType.DynamicPlayerData = TestDataBuilders.buildDynamicPlayerData(
    {
        researchLevels: new Map<GameType.ResearchType, number>([[GameType.ResearchType.EnergyTech, 4], [GameType.ResearchType.EspionageTech, defenderEspionageTech]]),
    });
    const targetPlayer: CoreType.PlayerData = TestDataBuilders.buildPlayerData(
    {
        playerRow: { id: TARGET_PLAYER_ID },
        dynamicPlayerData: targetDynamicPlayerData,
        planetDatas: [targetPlanet],
    });
    targetPlayer.publicPlayerDatas = [TestDataBuilders.buildPublicPlayerData({ id: TARGET_PLAYER_ID, username: "Victim" })];

    return { fleet, originPlanet, targetPlanet, originPlayer, targetPlayer };
}

describe('resolveEspionageAction — report contents', () =>
{
    it('reveals every block to the attacker when many probes are sent', () =>
    {
        const result: SetupResult = setup(10, ESCAPED_SEED);
        EspionageAction.resolveEspionageAction(result.originPlayer, result.targetPlayer, result.fleet, TestDataBuilders.buildServerData());

        const body: string = result.fleet.originMessageRow!.body;
        expect(result.fleet.originMessageRow!.type).toBe(MessageData.MessageType.Espionage);
        expect(body).toMatch(/1234 Metal/);
        expect(body).toMatch(/3 Small Transport/);
        expect(body).toMatch(/Metal Mine 7/);
        expect(body).toMatch(/Energy Technology 4/);
    });

    it('redacts the higher blocks when only a single probe is sent', () =>
    {
        const result: SetupResult = setup(1, ESCAPED_SEED);
        EspionageAction.resolveEspionageAction(result.originPlayer, result.targetPlayer, result.fleet, TestDataBuilders.buildServerData());

        const body: string = result.fleet.originMessageRow!.body;
        expect(body).toMatch(/1234 Metal/);
        expect(body).toMatch(/insufficient probes/);
        expect(body).not.toMatch(/Energy Technology 4/);
    });

    it('reports on a moon target the same way as a planet', () =>
    {
        const result: SetupResult = setup(10, ESCAPED_SEED, { targetZone: GameType.PlanetZone.Moon });
        EspionageAction.resolveEspionageAction(result.originPlayer, result.targetPlayer, result.fleet, TestDataBuilders.buildServerData());

        expect(result.fleet.resolutionState).toBe(CoreType.FleetMovementResolution.Resolved);
        const body: string = result.fleet.originMessageRow!.body;
        expect(body).toMatch(/1234 Metal/);
        expect(body).toMatch(/Metal Mine 7/);
    });
});

describe('resolveEspionageAction — research-tech difference drives the info level', () =>
{
    it('reveals research with a single probe when the attacker has a big tech lead', () =>
    {
        const result: SetupResult = setup(1, ESCAPED_SEED, { attackerEspionageTech: 5 });
        EspionageAction.resolveEspionageAction(result.originPlayer, result.targetPlayer, result.fleet, TestDataBuilders.buildServerData());

        // Same single probe as the redaction test, but the 5-level lead lifts the report past every threshold.
        expect(result.fleet.originMessageRow!.body).toMatch(/Energy Technology 4/);
    });

    it('redacts even the resources when the defender has a big tech lead', () =>
    {
        const result: SetupResult = setup(2, ESCAPED_SEED, { defenderEspionageTech: 5 });
        EspionageAction.resolveEspionageAction(result.originPlayer, result.targetPlayer, result.fleet, TestDataBuilders.buildServerData());

        const body: string = result.fleet.originMessageRow!.body;
        expect(body).toMatch(/insufficient probes/);
        expect(body).not.toMatch(/1234 Metal/);
    });
});

describe('resolveEspionageAction — counterespionage', () =>
{
    it('returns the probes home and does not warn the defender when undetected', () =>
    {
        const result: SetupResult = setup(1, ESCAPED_SEED);
        EspionageAction.resolveEspionageAction(result.originPlayer, result.targetPlayer, result.fleet, TestDataBuilders.buildServerData());

        expect(result.fleet.fleetMovementRow.is_return_trip).toBe(1);
        expect(result.fleet.resolutionState).toBe(CoreType.FleetMovementResolution.Resolved);
        expect(result.fleet.targetMessageRow).toBeNull();
        expect(result.targetPlanet.dynamicPlanetData.futureFleetArrivals.length).toBe(0);
    });

    it('destroys the probes and warns the defender when detected', () =>
    {
        const result: SetupResult = setup(10, DETECTED_SEED);
        EspionageAction.resolveEspionageAction(result.originPlayer, result.targetPlayer, result.fleet, TestDataBuilders.buildServerData());

        expect(result.fleet.fleetMovementRow.is_return_trip).toBe(0);
        expect(result.fleet.resolutionState).toBe(CoreType.FleetMovementResolution.Resolved);
        expect(result.fleet.targetMessageRow).not.toBeNull();
        expect(result.fleet.targetMessageRow!.type).toBe(MessageData.MessageType.Espionage);
        expect(result.fleet.targetMessageRow!.body).toMatch(/destroyed/);
        // Destroyed probes do not return: removed from both planets, no return trip.
        expect(result.originPlanet.dynamicPlanetData.futureFleetArrivals.length).toBe(0);
        expect(result.targetPlanet.dynamicPlanetData.futureFleetArrivals.length).toBe(0);
    });

    it('bounces home when no target body exists at the destination', () =>
    {
        const result: SetupResult = setup(1, ESCAPED_SEED);
        result.fleet.fleetMovementRow.planet_target_slot = 5;
        EspionageAction.resolveEspionageAction(result.originPlayer, result.targetPlayer, result.fleet, TestDataBuilders.buildServerData());

        expect(result.fleet.resolutionState).toBe(CoreType.FleetMovementResolution.Resolved);
        expect(result.fleet.fleetMovementRow.is_return_trip).toBe(1);
        expect(result.fleet.originMessageRow!.body).toMatch(/returning/i);
    });

    it('bounces home when the targeted moon was destroyed before arrival', () =>
    {
        const result: SetupResult = setup(1, ESCAPED_SEED, { targetZone: GameType.PlanetZone.Moon });
        // The moon is gone from the target's bodies by the time the probes arrive.
        result.targetPlayer.planetDatas = [];
        EspionageAction.resolveEspionageAction(result.originPlayer, result.targetPlayer, result.fleet, TestDataBuilders.buildServerData());

        expect(result.fleet.resolutionState).toBe(CoreType.FleetMovementResolution.Resolved);
        expect(result.fleet.fleetMovementRow.is_return_trip).toBe(1);
        expect(result.fleet.originMessageRow!.body).toMatch(/returning/i);
    });
});
