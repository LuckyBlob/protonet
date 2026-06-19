import { describe, it, expect } from 'vitest';
import * as ResourceProductionAnchorEvent from '@/lib/gameplay/progressUpdate/anchorEvent/resourceProductionAnchorEvent';
import * as AnchorEvent from '@/lib/gameplay/progressUpdate/anchorEvent';
import * as CoreType from '@/lib/gameplay/coreData/type/coreTypes';
import * as BuildingData from '@/lib/gameplay/dynamicData/planet/buildingData';
import * as BuildingEnergySetting from '@/lib/gameplay/dynamicData/planet/buildingEnergySettingData';
import * as GameType from '@/lib/gameplay/coreData/type/gameTypes';
import * as TestDataBuilders from '../helpers/testDataBuilders';
import * as TestProgressApplierHelper from '../helpers/testProgressApplier';

const APPLIER: TestProgressApplierHelper.TestProgressApplier = new TestProgressApplierHelper.TestProgressApplier();

// A Fusion Reactor with no Deuterium Synthesizer to offset it is the canonical draining setup:
// its production factor for Deuterium is negative, so the planet's net Deuterium rate goes below zero.
function buildDrainingPlanet(planetId: number, lastUpdated: number, deuteriumQuantity: number): CoreType.PlanetData
{
    const planetData: CoreType.PlanetData = TestDataBuilders.buildPlanetData(
    {
        planetRow: { id: planetId, last_updated: lastUpdated },
        dynamicPlanetData:
        {
            buildingLevels: new Map<GameType.BuildingType, number>([[GameType.BuildingType.FusionReactor, 1]]),
            resourceQuantity: new Map<GameType.ResourceType, number>
            ([
                [GameType.ResourceType.Metal, 2000],
                [GameType.ResourceType.Crystal, 500],
                [GameType.ResourceType.Deuterium, deuteriumQuantity],
            ]),
        },
    });

    return planetData;
}

describe('findNextAnchorEvent (resource production)', () =>
{
    it('returns null when no resource is draining', () =>
    {
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData();
        const serverData: CoreType.ServerData = TestDataBuilders.buildServerData();
        const result: AnchorEvent.AnchorEvent | null = ResourceProductionAnchorEvent.findNextAnchorEvent(playerData, serverData, APPLIER);
        expect(result).toBeNull();
    });

    it('returns a resource production anchor event for the draining resource', () =>
    {
        const planet: CoreType.PlanetData = buildDrainingPlanet(1, 1_000_000, 100);
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ planetDatas: [planet] });
        const serverData: CoreType.ServerData = TestDataBuilders.buildServerData();

        const result: AnchorEvent.AnchorEvent | null = ResourceProductionAnchorEvent.findNextAnchorEvent(playerData, serverData, APPLIER);

        expect(result).not.toBeNull();
        expect(result!.type).toBe(AnchorEvent.AnchorEventType.ResourceProduction);
        const resourceProductionEvent: ResourceProductionAnchorEvent.ResourceProductionAnchorEvent = result as ResourceProductionAnchorEvent.ResourceProductionAnchorEvent;
        expect(resourceProductionEvent.planetId).toBe(1);
        expect(resourceProductionEvent.resourceType).toBe(GameType.ResourceType.Deuterium);
    });

    it('computes the depletion time from the current quantity and drain rate', () =>
    {
        const lastUpdated: number = 1_000_000;
        const deuteriumQuantity: number = 100;
        const planet: CoreType.PlanetData = buildDrainingPlanet(1, lastUpdated, deuteriumQuantity);
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ planetDatas: [planet] });
        const serverData: CoreType.ServerData = TestDataBuilders.buildServerData();

        const drainRatePerSecond: number = BuildingData.getPlanetProductionRatePerSecond(planet, GameType.ResourceType.Deuterium, serverData, playerData);
        expect(drainRatePerSecond).toBeLessThan(0);

        const expectedTime: number = lastUpdated + Math.abs(deuteriumQuantity / drainRatePerSecond) * 1000;

        const result: AnchorEvent.AnchorEvent | null = ResourceProductionAnchorEvent.findNextAnchorEvent(playerData, serverData, APPLIER);
        expect(result).not.toBeNull();
        expect(result!.time).toBeCloseTo(expectedTime);
    });

    it('picks the earliest depletion across multiple planets', () =>
    {
        const earlyDepletingPlanet: CoreType.PlanetData = buildDrainingPlanet(1, 1_000_000, 50);
        const lateDepletingPlanet: CoreType.PlanetData = buildDrainingPlanet(2, 1_000_000, 500);
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ planetDatas: [earlyDepletingPlanet, lateDepletingPlanet] });
        const serverData: CoreType.ServerData = TestDataBuilders.buildServerData();

        const result: AnchorEvent.AnchorEvent | null = ResourceProductionAnchorEvent.findNextAnchorEvent(playerData, serverData, APPLIER);

        expect(result).not.toBeNull();
        const resourceProductionEvent: ResourceProductionAnchorEvent.ResourceProductionAnchorEvent = result as ResourceProductionAnchorEvent.ResourceProductionAnchorEvent;
        expect(resourceProductionEvent.planetId).toBe(1);
    });
});

describe('resolveAnchorEvent (resource production)', () =>
{
    it('sets the consuming building energy to zero', () =>
    {
        const planet: CoreType.PlanetData = buildDrainingPlanet(1, 1_000_000, 100);
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ planetDatas: [planet] });
        const serverData: CoreType.ServerData = TestDataBuilders.buildServerData();

        expect(BuildingEnergySetting.getBuildingEnergyPercentage(planet, GameType.BuildingType.FusionReactor)).toBe(100);

        const anchorEvent: AnchorEvent.AnchorEvent | null = ResourceProductionAnchorEvent.findNextAnchorEvent(playerData, serverData, APPLIER);
        expect(anchorEvent).not.toBeNull();
        ResourceProductionAnchorEvent.resolveAnchorEvent(playerData, serverData, anchorEvent!);

        expect(BuildingEnergySetting.getBuildingEnergyPercentage(playerData.planetDatas[0]!, GameType.BuildingType.FusionReactor)).toBe(0);
    });

    it('stops the resource from draining after resolution', () =>
    {
        const planet: CoreType.PlanetData = buildDrainingPlanet(1, 1_000_000, 100);
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ planetDatas: [planet] });
        const serverData: CoreType.ServerData = TestDataBuilders.buildServerData();

        const anchorEvent: AnchorEvent.AnchorEvent | null = ResourceProductionAnchorEvent.findNextAnchorEvent(playerData, serverData, APPLIER);
        expect(anchorEvent).not.toBeNull();
        ResourceProductionAnchorEvent.resolveAnchorEvent(playerData, serverData, anchorEvent!);

        const drainRateAfterResolution: number = BuildingData.getPlanetProductionRatePerSecond(playerData.planetDatas[0]!, GameType.ResourceType.Deuterium, serverData, playerData);
        expect(drainRateAfterResolution).toBeGreaterThanOrEqual(0);

        const followUpEvent: AnchorEvent.AnchorEvent | null = ResourceProductionAnchorEvent.findNextAnchorEvent(playerData, serverData, APPLIER);
        expect(followUpEvent).toBeNull();
    });
});
