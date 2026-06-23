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
        const shipQuantities: Map<GameType.ShipType, number> = new Map<GameType.ShipType, number>([[GameType.ShipType.ColonyShip, 1]]);
        const transportedResources: Map<GameType.ResourceType, number> = new Map<GameType.ResourceType, number>();

        const planetTarget: GameType.PlanetAddress = { galaxy: 2, system: 5, slot: 3, zone: GameType.PlanetZone.Planet };
        const moonTarget: GameType.PlanetAddress = { galaxy: 2, system: 5, slot: 3, zone: GameType.PlanetZone.Moon };

        const failedForPlanet: RequirementType.Requirement[] = Requirement.getFailedFleetMovementRequirements(player, GameType.FleetActionType.Colonize, 1, shipQuantities, transportedResources, planetTarget, null, false);
        const failedForMoon: RequirementType.Requirement[] = Requirement.getFailedFleetMovementRequirements(player, GameType.FleetActionType.Colonize, 1, shipQuantities, transportedResources, moonTarget, null, false);

        expect(failedForMoon.length).toBe(failedForPlanet.length + 1);
    });
});
