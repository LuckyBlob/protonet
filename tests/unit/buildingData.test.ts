import { describe, it, expect } from "vitest";

import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as BuildingData from "@/lib/gameplay/dynamicData/planet/buildingData";
import * as BuildingEnergySetting from "@/lib/gameplay/dynamicData/planet/buildingEnergySettingData";
import * as TestDataBuilders from "../helpers/testDataBuilders";

describe("buildingData — level accessors", () =>
{
    it("round-trips a building level and defaults unset buildings to 0", () =>
    {
        const planetData: CoreType.PlanetData = TestDataBuilders.buildPlanetData();

        expect(BuildingData.getBuildingLevel(planetData, GameType.BuildingType.MetalMine)).toBe(0);

        BuildingData.setBuildingLevel(planetData, GameType.BuildingType.MetalMine, 5);
        expect(BuildingData.getBuildingLevel(planetData, GameType.BuildingType.MetalMine)).toBe(5);
        expect(BuildingData.getBuildingLevel(planetData, GameType.BuildingType.CrystalGrower)).toBe(0);
    });
});

describe("buildingData — canAffordUpgrade", () =>
{
    it("affords a cheap first upgrade with the default resource stockpile", () =>
    {
        // Default planet has 2000 Metal / 500 Crystal; Metal Mine L0->L1 costs 60 / 15.
        const planetData: CoreType.PlanetData = TestDataBuilders.buildPlanetData();
        expect(BuildingData.canAffordUpgrade(planetData, GameType.BuildingType.MetalMine)).toBe(true);
    });

    it("cannot afford an upgrade with no resources", () =>
    {
        const planetData: CoreType.PlanetData = TestDataBuilders.buildPlanetData(
        {
            dynamicPlanetData:
            {
                resourceQuantity: new Map<GameType.ResourceType, number>(
                [
                    [GameType.ResourceType.Metal, 0],
                    [GameType.ResourceType.Crystal, 0],
                    [GameType.ResourceType.Deuterium, 0],
                ]),
            },
        });
        expect(BuildingData.canAffordUpgrade(planetData, GameType.BuildingType.MetalMine)).toBe(false);
    });

    it("throws for an unknown building (no registered stats)", () =>
    {
        const planetData: CoreType.PlanetData = TestDataBuilders.buildPlanetData();
        expect(() => BuildingData.canAffordUpgrade(planetData, 9999 as GameType.BuildingType)).toThrow();
    });
});

describe("buildingData — production / consumption classification", () =>
{
    it("flags only buildings that positively produce a resource", () =>
    {
        expect(BuildingData.doesBuildingProduceResource(GameType.BuildingType.MetalMine, GameType.ResourceType.Metal)).toBe(true);
        expect(BuildingData.doesBuildingProduceResource(GameType.BuildingType.DeuteriumSynthesizer, GameType.ResourceType.Deuterium)).toBe(true);

        // Metal Mine does not produce Crystal, and the Fusion Reactor drains Deuterium (negative factor), so neither counts as producing.
        expect(BuildingData.doesBuildingProduceResource(GameType.BuildingType.MetalMine, GameType.ResourceType.Crystal)).toBe(false);
        expect(BuildingData.doesBuildingProduceResource(GameType.BuildingType.FusionReactor, GameType.ResourceType.Deuterium)).toBe(false);

        // Solar Plant has no production stats at all.
        expect(BuildingData.doesBuildingProduceResource(GameType.BuildingType.SolarPlant, GameType.ResourceType.Metal)).toBe(false);
    });

    it("lists the buildings that consume (negatively produce) a resource", () =>
    {
        const deuteriumConsumers: GameType.BuildingType[] = BuildingData.getConsumingBuildingTypeArrayForResourceType(GameType.ResourceType.Deuterium);
        expect(deuteriumConsumers).toEqual([GameType.BuildingType.FusionReactor]);

        // Nothing consumes Metal.
        const metalConsumers: GameType.BuildingType[] = BuildingData.getConsumingBuildingTypeArrayForResourceType(GameType.ResourceType.Metal);
        expect(metalConsumers).toEqual([]);
    });

    it("zeroes the energy setting of consuming buildings only", () =>
    {
        const planetData: CoreType.PlanetData = TestDataBuilders.buildPlanetData();

        BuildingData.setConsumingBuildingsEnergyToZero(planetData, GameType.ResourceType.Deuterium);

        expect(BuildingEnergySetting.getBuildingEnergyPercentage(planetData, GameType.BuildingType.FusionReactor)).toBe(0);
        // The Deuterium producer is not a consumer, so it stays at full power.
        expect(BuildingEnergySetting.getBuildingEnergyPercentage(planetData, GameType.BuildingType.DeuteriumSynthesizer)).toBe(100);
    });
});
