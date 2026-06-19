import { describe, it, expect } from 'vitest';
import * as ApplyProgress from '@/lib/gameplay/progressUpdate/applyProgress';
import * as CoreType from '@/lib/gameplay/coreData/type/coreTypes';
import * as ResourceData from '@/lib/gameplay/dynamicData/planet/resourceData';
import * as BuildingEnergySetting from '@/lib/gameplay/dynamicData/planet/buildingEnergySettingData';
import * as BuildingData from '@/lib/gameplay/dynamicData/planet/buildingData';
import * as GameType from '@/lib/gameplay/coreData/type/gameTypes';
import * as TestDataBuilders from '../helpers/testDataBuilders';
import * as TestProgressApplierHelper from '../helpers/testProgressApplier';

const APPLIER: TestProgressApplierHelper.TestProgressApplier = new TestProgressApplierHelper.TestProgressApplier();
const BASE_TIME: number = 1_000_000;
const HOUR_MS: number = 3_600_000;

// A Fusion Reactor at level 1 drains Deuterium at floor(-10 * 1 * 1.1^1) = -11/hr. With no Deuterium
// Synthesizer to offset it and no energy consumers (so the energy ratio stays at 1), the planet's net
// Deuterium rate is exactly -11/hr. Starting at 11 Deuterium, the planet depletes in exactly one hour.
const DEUTERIUM_DRAIN_PER_HOUR: number = 11;

function buildDrainingPlanet(startingDeuterium: number): CoreType.PlanetData
{
    const planet: CoreType.PlanetData = TestDataBuilders.buildPlanetData(
    {
        planetRow: { id: 1, last_updated: BASE_TIME },
        dynamicPlanetData:
        {
            resourceQuantity: new Map<GameType.ResourceType, number>
            ([
                [GameType.ResourceType.Metal, 2000],
                [GameType.ResourceType.Crystal, 500],
                [GameType.ResourceType.Deuterium, startingDeuterium],
            ]),
            buildingLevels: new Map<GameType.BuildingType, number>
            ([
                [GameType.BuildingType.FusionReactor, 1],
            ]),
        },
    });

    return planet;
}

describe('resource depletion pipeline — draining a resource through applyProgressToPlayerData', () =>
{
    it('drains normally while the resource is still above zero', () =>
    {
        const planet: CoreType.PlanetData = buildDrainingPlanet(DEUTERIUM_DRAIN_PER_HOUR);
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ planetDatas: [planet] });
        const serverData: CoreType.ServerData = TestDataBuilders.buildServerData();

        // Half an hour: 11 - 5.5 = 5.5 Deuterium left, depletion has not happened yet so the
        // Fusion Reactor is still at full power.
        const halfHourLater: number = BASE_TIME + HOUR_MS / 2;
        const result: CoreType.PlayerData = ApplyProgress.applyProgressToPlayerData(playerData, serverData, halfHourLater, APPLIER);

        // Resource quantities are floored to integers, so half an hour of -11/hr drain lands at floor(5.5) = 5:
        // still above zero, so depletion has not happened and the Fusion Reactor is untouched at full power.
        const deuterium: number = ResourceData.getResourceQuantity(result.planetDatas[0]!, GameType.ResourceType.Deuterium);
        expect(deuterium).toBeGreaterThan(0);
        expect(deuterium).toBeLessThan(DEUTERIUM_DRAIN_PER_HOUR);
        expect(BuildingEnergySetting.getBuildingEnergyPercentage(result.planetDatas[0]!, GameType.BuildingType.FusionReactor)).toBe(100);
    });

    it('throttles the consuming building to 0% when the resource depletes, and never goes negative', () =>
    {
        const planet: CoreType.PlanetData = buildDrainingPlanet(DEUTERIUM_DRAIN_PER_HOUR);
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ planetDatas: [planet] });
        const serverData: CoreType.ServerData = TestDataBuilders.buildServerData();

        // Two hours: depletion lands at BASE + 1h, the resource production anchor event resolves and
        // sets the Fusion Reactor to 0%, so the remaining hour adds no further drain.
        const twoHoursLater: number = BASE_TIME + 2 * HOUR_MS;
        const result: CoreType.PlayerData = ApplyProgress.applyProgressToPlayerData(playerData, serverData, twoHoursLater, APPLIER);

        const deuterium: number = ResourceData.getResourceQuantity(result.planetDatas[0]!, GameType.ResourceType.Deuterium);
        expect(deuterium).toBe(0);
        expect(BuildingEnergySetting.getBuildingEnergyPercentage(result.planetDatas[0]!, GameType.BuildingType.FusionReactor)).toBe(0);

        // The building being throttled means it no longer drains the resource.
        const drainRateAfter: number = BuildingData.getPlanetProductionRatePerSecond(result.planetDatas[0]!, GameType.ResourceType.Deuterium, serverData, result);
        expect(drainRateAfter).toBeGreaterThanOrEqual(0);
    });
});
