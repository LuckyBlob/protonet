import { describe, it, expect } from 'vitest';
import * as Requirement from '@/lib/gameplay/coreData/requirement/requirements';
import * as RequirementValueGetters from '@/lib/gameplay/coreData/requirement/requirementValueGetters';
import * as RequirementType from '@/lib/gameplay/coreData/requirement/requirementTypes';
import * as GameType from '@/lib/gameplay/coreData/type/gameTypes';
import * as CoreType from '@/lib/gameplay/coreData/type/coreTypes';
import * as TestDataBuilders from '../helpers/testDataBuilders';

describe('getTargetPlanetZone requirement getter', () =>
{
    it('returns the target address zone', () =>
    {
        const getter: RequirementType.ThingValueGetter = RequirementValueGetters.getTargetPlanetZone();
        const context: RequirementType.RequirementContext =
        {
            playerData: TestDataBuilders.buildPlayerData(),
            planetId: 1,
            targetPlanetAddress: { galaxy: 1, system: 1, slot: 1, zone: GameType.PlanetZone.Moon },
        };
        expect(getter(context)).toBe(GameType.PlanetZone.Moon);
    });

    it('throws when no target address is present', () =>
    {
        const getter: RequirementType.ThingValueGetter = RequirementValueGetters.getTargetPlanetZone();
        const context: RequirementType.RequirementContext =
        {
            playerData: TestDataBuilders.buildPlayerData(),
            planetId: 1,
        };
        expect(() => getter(context)).toThrow();
    });
});

describe('Colonize fleet requirements — target zone must be Planet', () =>
{
    function buildColonizerPlayer(): CoreType.PlayerData
    {
        const planet: CoreType.PlanetData = TestDataBuilders.buildPlanetData({ planetRow: { id: 1 } });
        return TestDataBuilders.buildPlayerData({ playerRow: { id: 1 }, planetDatas: [planet] });
    }

    // Only the target zone differs between the two calls, so any per-call requirement that isn't the
    // zone one evaluates identically. A Moon target must therefore fail exactly one extra requirement.
    it('fails exactly one more requirement for a Moon target than for a Planet target', () =>
    {
        const player: CoreType.PlayerData = buildColonizerPlayer();
        const unitQuantities: Map<GameType.UnitType, number> = new Map<GameType.UnitType, number>([[GameType.UnitType.ColonyShip, 1]]);
        const transportedResources: Map<GameType.ResourceType, number> = new Map<GameType.ResourceType, number>();

        const planetTarget: GameType.PlanetAddress = { galaxy: 2, system: 5, slot: 3, zone: GameType.PlanetZone.Planet };
        const moonTarget: GameType.PlanetAddress = { galaxy: 2, system: 5, slot: 3, zone: GameType.PlanetZone.Moon };

        const failedForPlanet: RequirementType.Requirement[] = Requirement.getFailedFleetMovementRequirements(player, GameType.FleetActionType.Colonize, 1, unitQuantities, transportedResources, planetTarget, null, false);
        const failedForMoon: RequirementType.Requirement[] = Requirement.getFailedFleetMovementRequirements(player, GameType.FleetActionType.Colonize, 1, unitQuantities, transportedResources, moonTarget, null, false);

        expect(failedForMoon.length).toBe(failedForPlanet.length + 1);
    });
});

describe('Transport fleet requirements', () =>
{
    const SELF_ID: number = 1;
    const TARGET_OWNER_ID: number = 2;
    const ONE_TRANSPORT: Map<GameType.UnitType, number> = new Map<GameType.UnitType, number>([[GameType.UnitType.SmallTransport, 1]]);
    const SOME_RESOURCES: Map<GameType.ResourceType, number> = new Map<GameType.ResourceType, number>([[GameType.ResourceType.Metal, 100]]);
    const NO_RESOURCES: Map<GameType.ResourceType, number> = new Map<GameType.ResourceType, number>();
    const TARGET: GameType.PlanetAddress = { galaxy: 1, system: 1, slot: 4, zone: GameType.PlanetZone.Planet };

    function buildSender(): CoreType.PlayerData
    {
        const planet: CoreType.PlanetData = TestDataBuilders.buildPlanetData({ planetRow: { id: 1 } });
        return TestDataBuilders.buildPlayerData({ playerRow: { id: SELF_ID }, planetDatas: [planet] });
    }

    it('is blocked when no resources are carried', () =>
    {
        const player: CoreType.PlayerData = buildSender();
        const failed: RequirementType.Requirement[] = Requirement.getFailedFleetMovementRequirements(player, GameType.FleetActionType.Transport, 1, ONE_TRANSPORT, NO_RESOURCES, TARGET, SELF_ID, true);
        expect(failed.length).toBeGreaterThan(0);
    });

    it('is blocked when the target zone does not exist', () =>
    {
        const player: CoreType.PlayerData = buildSender();
        const failed: RequirementType.Requirement[] = Requirement.getFailedFleetMovementRequirements(player, GameType.FleetActionType.Transport, 1, ONE_TRANSPORT, SOME_RESOURCES, TARGET, SELF_ID, false);
        expect(failed.length).toBeGreaterThan(0);
    });

    it('is allowed when resources are carried and the target zone exists', () =>
    {
        const player: CoreType.PlayerData = buildSender();
        const failed: RequirementType.Requirement[] = Requirement.getFailedFleetMovementRequirements(player, GameType.FleetActionType.Transport, 1, ONE_TRANSPORT, SOME_RESOURCES, TARGET, SELF_ID, true);
        expect(failed).toHaveLength(0);
    });

    it('is NOT score-gated: a strong attacker can transport to a weak sub-threshold player while Station cannot', () =>
    {
        const player: CoreType.PlayerData = buildSender();
        // Strong attacker (100000) vs a weak owned target (1): the 5x score gate blocks Station/Collect but not Transport.
        player.publicPlayerRows =
        [
            TestDataBuilders.buildPublicPlayerRow({ id: SELF_ID, score: 100_000 }),
            TestDataBuilders.buildPublicPlayerRow({ id: TARGET_OWNER_ID, score: 1 }),
        ];

        const transportFailed: RequirementType.Requirement[] = Requirement.getFailedFleetMovementRequirements(player, GameType.FleetActionType.Transport, 1, ONE_TRANSPORT, SOME_RESOURCES, TARGET, TARGET_OWNER_ID, true);
        const stationFailed: RequirementType.Requirement[] = Requirement.getFailedFleetMovementRequirements(player, GameType.FleetActionType.Station, 1, ONE_TRANSPORT, SOME_RESOURCES, TARGET, TARGET_OWNER_ID, true);

        expect(transportFailed).toHaveLength(0);
        expect(stationFailed.length).toBeGreaterThan(0);
    });
});
