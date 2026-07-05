import { describe, it, expect } from "vitest";

import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as CalculatedValueData from "@/lib/gameplay/dynamicData/calculatedValueData";
import * as TestDataBuilders from "../helpers/testDataBuilders";

function buildPlanetWithBuildings(buildingLevels: Map<GameType.BuildingType, number>): CoreType.PlanetData
{
    const planetData: CoreType.PlanetData = TestDataBuilders.buildPlanetData(
    {
        dynamicPlanetData:
        {
            buildingLevels: buildingLevels,
        },
    });

    return planetData;
}

describe("calculatedValueData — planet value aggregation", () =>
{
    it("sums energy production and consumption across buildings", () =>
    {
        // Metal Mine L1 consumes 11, Solar Plant L10 produces 518.
        const planetData: CoreType.PlanetData = buildPlanetWithBuildings(new Map<GameType.BuildingType, number>(
        [
            [GameType.BuildingType.MetalMine, 1],
            [GameType.BuildingType.SolarPlant, 10],
        ]));

        const energy: CoreType.CalculatedValueData | null = CalculatedValueData.computePlanetValueData(planetData, GameType.PlanetValueType.Energy, TestDataBuilders.buildPlayerData());
        expect(energy!.production).toBe(518);
        expect(energy!.consumption).toBe(11);
    });

    it("accumulates consumption from multiple consumers", () =>
    {
        // Metal Mine L1 (11) + Crystal Grower L1 (11) = 22.
        const planetData: CoreType.PlanetData = buildPlanetWithBuildings(new Map<GameType.BuildingType, number>(
        [
            [GameType.BuildingType.MetalMine, 1],
            [GameType.BuildingType.CrystalGrower, 1],
        ]));

        const energy: CoreType.CalculatedValueData | null = CalculatedValueData.computePlanetValueData(planetData, GameType.PlanetValueType.Energy, TestDataBuilders.buildPlayerData());
        expect(energy!.consumption).toBe(22);
        expect(energy!.production).toBe(0);
    });

    it("returns null for an unknown planet value type", () =>
    {
        const planetData: CoreType.PlanetData = TestDataBuilders.buildPlanetData();
        const result: CoreType.CalculatedValueData | null = CalculatedValueData.computePlanetValueData(planetData, 9999 as GameType.PlanetValueType, TestDataBuilders.buildPlayerData());
        expect(result).toBeNull();
    });
});

describe("calculatedValueData — resource production ratio", () =>
{
    it("defaults to 1 when there is no energy consumption (fresh planet)", () =>
    {
        const planetData: CoreType.PlanetData = TestDataBuilders.buildPlanetData();
        const ratio: number = CalculatedValueData.computeResourceProductionPlanetValueRatio(planetData, GameType.ResourceType.Metal, TestDataBuilders.buildPlayerData());
        expect(ratio).toBe(1);
    });

    it("throttles by production over consumption when undersupplied", () =>
    {
        // Metal Mine L5 consumes 80, Solar Plant L2 produces 48 -> 48/80 = 0.6.
        const planetData: CoreType.PlanetData = buildPlanetWithBuildings(new Map<GameType.BuildingType, number>(
        [
            [GameType.BuildingType.MetalMine, 5],
            [GameType.BuildingType.SolarPlant, 2],
        ]));

        const metalRatio: number = CalculatedValueData.computeResourceProductionPlanetValueRatio(planetData, GameType.ResourceType.Metal, TestDataBuilders.buildPlayerData());
        expect(metalRatio).toBeCloseTo(0.6);

        // Energy has no associated resource, so the same ratio applies to every resource.
        const crystalRatio: number = CalculatedValueData.computeResourceProductionPlanetValueRatio(planetData, GameType.ResourceType.Crystal, TestDataBuilders.buildPlayerData());
        expect(crystalRatio).toBeCloseTo(0.6);
    });

    it("drops to 0 when there is consumption but no production", () =>
    {
        const planetData: CoreType.PlanetData = buildPlanetWithBuildings(new Map<GameType.BuildingType, number>(
        [
            [GameType.BuildingType.MetalMine, 5],
        ]));

        const ratio: number = CalculatedValueData.computeResourceProductionPlanetValueRatio(planetData, GameType.ResourceType.Metal, TestDataBuilders.buildPlayerData());
        expect(ratio).toBe(0);
    });

    it("caps at 1 when production exceeds consumption", () =>
    {
        const planetData: CoreType.PlanetData = buildPlanetWithBuildings(new Map<GameType.BuildingType, number>(
        [
            [GameType.BuildingType.MetalMine, 5],
            [GameType.BuildingType.SolarPlant, 10],
        ]));

        const ratio: number = CalculatedValueData.computeResourceProductionPlanetValueRatio(planetData, GameType.ResourceType.Metal, TestDataBuilders.buildPlayerData());
        expect(ratio).toBe(1);
    });
});

describe("calculatedValueData — resource maximums (storage caps)", () =>
{
    it("uses the level-0 base storage for every resource on a fresh planet", () =>
    {
        const planetData: CoreType.PlanetData = TestDataBuilders.buildPlanetData();
        const resourceMaximums: Map<GameType.ResourceType, number> = CalculatedValueData.computeResourceMaximums(planetData, TestDataBuilders.buildPlayerData());

        expect(resourceMaximums.get(GameType.ResourceType.Metal)).toBe(10000);
        expect(resourceMaximums.get(GameType.ResourceType.Crystal)).toBe(10000);
        expect(resourceMaximums.get(GameType.ResourceType.Deuterium)).toBe(10000);
    });

    it("raises a resource maximum as its storage building levels up", () =>
    {
        const planetData: CoreType.PlanetData = buildPlanetWithBuildings(new Map<GameType.BuildingType, number>(
        [
            [GameType.BuildingType.MetalStorage, 1],
        ]));

        const resourceMaximums: Map<GameType.ResourceType, number> = CalculatedValueData.computeResourceMaximums(planetData, TestDataBuilders.buildPlayerData());
        expect(resourceMaximums.get(GameType.ResourceType.Metal)).toBe(20000);
        // Untouched storages stay at their base.
        expect(resourceMaximums.get(GameType.ResourceType.Crystal)).toBe(10000);
    });
});

describe("calculatedValueData — size budget", () =>
{
    it("uses the planet's rolled size as the base field budget on a fresh planet", () =>
    {
        const planetData: CoreType.PlanetData = TestDataBuilders.buildPlanetData({ planetRow: { size: 163 } });
        const size: CoreType.CalculatedValueData | null = CalculatedValueData.computePlanetValueData(planetData, GameType.PlanetValueType.Size, TestDataBuilders.buildPlayerData());
        expect(size!.production).toBe(163);
        expect(size!.consumption).toBe(0);
    });

    it("consumes one field per building level, summed across buildings", () =>
    {
        const planetData: CoreType.PlanetData = buildPlanetWithBuildings(new Map<GameType.BuildingType, number>(
        [
            [GameType.BuildingType.MetalMine, 5],
            [GameType.BuildingType.Shipyard, 3],
        ]));

        const size: CoreType.CalculatedValueData | null = CalculatedValueData.computePlanetValueData(planetData, GameType.PlanetValueType.Size, TestDataBuilders.buildPlayerData());
        expect(size!.consumption).toBe(8);
    });

    it("adds floor(5.5 * level) fields from the Terraformer (and it still self-consumes a field per level)", () =>
    {
        const planetData: CoreType.PlanetData = TestDataBuilders.buildPlanetData(
        {
            planetRow: { size: 163 },
            dynamicPlanetData: { buildingLevels: new Map<GameType.BuildingType, number>([[GameType.BuildingType.Terraformer, 4]]) },
        });

        const size: CoreType.CalculatedValueData | null = CalculatedValueData.computePlanetValueData(planetData, GameType.PlanetValueType.Size, TestDataBuilders.buildPlayerData());
        expect(size!.production).toBe(185);
        expect(size!.consumption).toBe(4);
    });

    it("adds 3 fields per Lunar Base level on a moon's base size of 1", () =>
    {
        const moonData: CoreType.PlanetData = TestDataBuilders.buildPlanetData(
        {
            planetRow: { size: 1, zone: GameType.PlanetZone.Moon },
            dynamicPlanetData: { buildingLevels: new Map<GameType.BuildingType, number>([[GameType.BuildingType.LunarBase, 3]]) },
        });

        const size: CoreType.CalculatedValueData | null = CalculatedValueData.computePlanetValueData(moonData, GameType.PlanetValueType.Size, TestDataBuilders.buildPlayerData());
        expect(size!.production).toBe(10);
        expect(size!.consumption).toBe(3);
    });

    it("applies the energy throttle to a building's energy value only, never to its field consumption", () =>
    {
        const throttledPlanetData: CoreType.PlanetData = buildPlanetWithBuildings(new Map<GameType.BuildingType, number>([[GameType.BuildingType.MetalMine, 4]]));
        throttledPlanetData.dynamicPlanetData.buildingEnergySettings.set(GameType.BuildingType.MetalMine, 0);

        const fullPowerPlanetData: CoreType.PlanetData = buildPlanetWithBuildings(new Map<GameType.BuildingType, number>([[GameType.BuildingType.MetalMine, 4]]));

        const fullPowerEnergy: CoreType.CalculatedValueData | null = CalculatedValueData.computePlanetValueData(fullPowerPlanetData, GameType.PlanetValueType.Energy, TestDataBuilders.buildPlayerData());
        const throttledEnergy: CoreType.CalculatedValueData | null = CalculatedValueData.computePlanetValueData(throttledPlanetData, GameType.PlanetValueType.Energy, TestDataBuilders.buildPlayerData());

        expect(fullPowerEnergy!.consumption).toBeGreaterThan(0);
        expect(throttledEnergy!.consumption).toBe(0);

        const throttledSize: CoreType.CalculatedValueData | null = CalculatedValueData.computePlanetValueData(throttledPlanetData, GameType.PlanetValueType.Size, TestDataBuilders.buildPlayerData());
        expect(throttledSize!.consumption).toBe(4);
    });
});

describe("calculatedValueData — player values", () =>
{
    it("derives fleet slots from Computer Tech research", () =>
    {
        // No research -> Computer Tech level 0 -> 1 slot.
        const freshPlayer: CoreType.PlayerData = TestDataBuilders.buildPlayerData();
        const freshSlots: CoreType.CalculatedValueData | null = CalculatedValueData.computePlayerValueData(freshPlayer, GameType.PlayerValueType.FleetSlots);
        expect(freshSlots!.production).toBe(1);
        expect(freshSlots!.consumption).toBe(0);

        // Computer Tech level 2 -> 3 slots.
        const researchedPlayer: CoreType.PlayerData = TestDataBuilders.buildPlayerData(
        {
            dynamicPlayerData: TestDataBuilders.buildDynamicPlayerData(
            {
                researchLevels: new Map<GameType.ResearchType, number>([[GameType.ResearchType.ComputerTech, 2]]),
            }),
        });
        const researchedSlots: CoreType.CalculatedValueData | null = CalculatedValueData.computePlayerValueData(researchedPlayer, GameType.PlayerValueType.FleetSlots);
        expect(researchedSlots!.production).toBe(3);
    });

    it("returns null for an unknown player value type", () =>
    {
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData();
        const result: CoreType.CalculatedValueData | null = CalculatedValueData.computePlayerValueData(playerData, 9999 as GameType.PlayerValueType);
        expect(result).toBeNull();
    });
});

describe("calculatedValueData — planet value breakdown", () =>
{
    it("lists energy producers before consumers with signed rates summing to the net (Solar Plant L10 = +518, Metal Mine L1 = -11)", () =>
    {
        const planetData: CoreType.PlanetData = buildPlanetWithBuildings(new Map<GameType.BuildingType, number>(
        [
            [GameType.BuildingType.MetalMine, 1],
            [GameType.BuildingType.SolarPlant, 10],
        ]));

        const breakdown: CalculatedValueData.CalculatedValueBreakdown = CalculatedValueData.computePlanetValueBreakdown(planetData, GameType.PlanetValueType.Energy, TestDataBuilders.buildPlayerData());

        expect(breakdown.sourceContributions).toHaveLength(2);

        expect(breakdown.sourceContributions[0].source.specificThingType).toBe(GameType.BuildingType.SolarPlant);
        expect(breakdown.sourceContributions[0].ratePerHour).toBe(518);
        expect(breakdown.sourceContributions[1].source.specificThingType).toBe(GameType.BuildingType.MetalMine);
        expect(breakdown.sourceContributions[1].ratePerHour).toBe(-11);

        expect(breakdown.bonusContributions).toHaveLength(0);
        expect(breakdown.totalRatePerHour).toBe(507);
    });
});
