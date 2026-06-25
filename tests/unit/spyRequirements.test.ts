import { describe, it, expect } from 'vitest';
import * as Requirement from '@/lib/gameplay/coreData/requirement/requirements';
import * as RequirementValueGetters from '@/lib/gameplay/coreData/requirement/requirementValueGetters';
import * as RequirementType from '@/lib/gameplay/coreData/requirement/requirementTypes';
import * as GameType from '@/lib/gameplay/coreData/type/gameTypes';
import * as CoreType from '@/lib/gameplay/coreData/type/coreTypes';
import * as StaticDataHelper from '@/lib/gameplay/coreData/static/staticDataHelpers';
import * as TestDataBuilders from '../helpers/testDataBuilders';

describe('canShipSpy', () =>
{
    it('is true for the Espionage Probe and false for other ships', () =>
    {
        expect(StaticDataHelper.canShipSpy(GameType.ShipType.EspionageProbe)).toBe(true);
        expect(StaticDataHelper.canShipSpy(GameType.ShipType.SmallTransport)).toBe(false);
        expect(StaticDataHelper.canShipSpy(GameType.ShipType.Recycler)).toBe(false);
    });
});

describe('allFleetShipsCanSpy requirement getter', () =>
{
    it('returns 1 when every ship in the fleet is a probe', () =>
    {
        const getter: RequirementType.ThingValueGetter = RequirementValueGetters.allFleetShipsCanSpy();
        const context: RequirementType.RequirementContext =
        {
            playerData: TestDataBuilders.buildPlayerData(),
            planetId: 1,
            shipQuantities: new Map<GameType.ShipType, number>([[GameType.ShipType.EspionageProbe, 5]]),
        };
        expect(getter(context)).toBe(1);
    });

    it('returns 0 when any ship in the fleet is not a probe', () =>
    {
        const getter: RequirementType.ThingValueGetter = RequirementValueGetters.allFleetShipsCanSpy();
        const context: RequirementType.RequirementContext =
        {
            playerData: TestDataBuilders.buildPlayerData(),
            planetId: 1,
            shipQuantities: new Map<GameType.ShipType, number>([[GameType.ShipType.EspionageProbe, 5], [GameType.ShipType.SmallTransport, 1]]),
        };
        expect(getter(context)).toBe(0);
    });

    it('ignores zero-quantity ship types', () =>
    {
        const getter: RequirementType.ThingValueGetter = RequirementValueGetters.allFleetShipsCanSpy();
        const context: RequirementType.RequirementContext =
        {
            playerData: TestDataBuilders.buildPlayerData(),
            planetId: 1,
            shipQuantities: new Map<GameType.ShipType, number>([[GameType.ShipType.EspionageProbe, 5], [GameType.ShipType.SmallTransport, 0]]),
        };
        expect(getter(context)).toBe(1);
    });

    it('throws when there is no fleet (shipQuantities undefined)', () =>
    {
        const getter: RequirementType.ThingValueGetter = RequirementValueGetters.allFleetShipsCanSpy();
        const context: RequirementType.RequirementContext =
        {
            playerData: TestDataBuilders.buildPlayerData(),
            planetId: 1,
        };
        expect(() => getter(context)).toThrow();
    });
});

describe('Espionage fleet requirements', () =>
{
    // The tech is required to BUILD a probe, not to send one, so the fleet action itself needs no
    // research — only a probe-only fleet against a spyable, existing target.
    function buildSpyingPlayer(): CoreType.PlayerData
    {
        const planet: CoreType.PlanetData = TestDataBuilders.buildPlanetData({ planetRow: { id: 1 } });
        return TestDataBuilders.buildPlayerData({ playerRow: { id: 1 }, planetDatas: [planet] });
    }

    const probeFleet: Map<GameType.ShipType, number> = new Map<GameType.ShipType, number>([[GameType.ShipType.EspionageProbe, 1]]);
    const noResources: Map<GameType.ResourceType, number> = new Map<GameType.ResourceType, number>();
    const target: GameType.PlanetAddress = { galaxy: 2, system: 5, slot: 3, zone: GameType.PlanetZone.Planet };
    const moonTarget: GameType.PlanetAddress = { galaxy: 2, system: 5, slot: 3, zone: GameType.PlanetZone.Moon };
    const debrisTarget: GameType.PlanetAddress = { galaxy: 2, system: 5, slot: 3, zone: GameType.PlanetZone.DebrisField };
    const targetOwnerId: number = 2;

    it('passes for a probe-only fleet against an existing planet target', () =>
    {
        const player: CoreType.PlayerData = buildSpyingPlayer();

        const failed: RequirementType.Requirement[] = Requirement.getFailedFleetMovementRequirements(player, GameType.FleetActionType.Espionage, 1, probeFleet, noResources, target, targetOwnerId, true);
        expect(failed.length).toBe(0);
    });

    it('passes against a moon target', () =>
    {
        const player: CoreType.PlayerData = buildSpyingPlayer();

        const failed: RequirementType.Requirement[] = Requirement.getFailedFleetMovementRequirements(player, GameType.FleetActionType.Espionage, 1, probeFleet, noResources, moonTarget, targetOwnerId, true);
        expect(failed.length).toBe(0);
    });

    it('fails against a debris field target', () =>
    {
        const player: CoreType.PlayerData = buildSpyingPlayer();

        const failed: RequirementType.Requirement[] = Requirement.getFailedFleetMovementRequirements(player, GameType.FleetActionType.Espionage, 1, probeFleet, noResources, debrisTarget, targetOwnerId, true);
        expect(failed.length).toBeGreaterThan(0);
    });

    it('fails when the fleet contains a non-spy ship', () =>
    {
        const player: CoreType.PlayerData = buildSpyingPlayer();
        const mixedFleet: Map<GameType.ShipType, number> = new Map<GameType.ShipType, number>([[GameType.ShipType.EspionageProbe, 1], [GameType.ShipType.SmallTransport, 1]]);

        const failed: RequirementType.Requirement[] = Requirement.getFailedFleetMovementRequirements(player, GameType.FleetActionType.Espionage, 1, mixedFleet, noResources, target, targetOwnerId, true);
        expect(failed.length).toBeGreaterThan(0);
    });

    it('fails when the fleet has no probe at all', () =>
    {
        const player: CoreType.PlayerData = buildSpyingPlayer();
        const transportFleet: Map<GameType.ShipType, number> = new Map<GameType.ShipType, number>([[GameType.ShipType.SmallTransport, 1]]);

        const failed: RequirementType.Requirement[] = Requirement.getFailedFleetMovementRequirements(player, GameType.FleetActionType.Espionage, 1, transportFleet, noResources, target, targetOwnerId, true);
        expect(failed.length).toBeGreaterThan(0);
    });

    it('fails when there is no body at the target coordinates', () =>
    {
        const player: CoreType.PlayerData = buildSpyingPlayer();

        const failed: RequirementType.Requirement[] = Requirement.getFailedFleetMovementRequirements(player, GameType.FleetActionType.Espionage, 1, probeFleet, noResources, target, targetOwnerId, false);
        expect(failed.length).toBeGreaterThan(0);
    });
});
