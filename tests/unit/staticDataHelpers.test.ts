import { describe, it, expect } from "vitest";

import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as StaticDataHelper from "@/lib/gameplay/coreData/static/staticDataHelpers";
import * as TestDataBuilders from "../helpers/testDataBuilders";

describe("getPlanetDisplayName", () =>
{
    it("falls back to the coordinate label when the name is null", () =>
    {
        const planetData: CoreType.PlanetData = TestDataBuilders.buildPlanetData({ planetRow: { galaxy: 1, system: 1, slot: 3, zone: GameType.PlanetZone.Planet, name: null } });
        expect(StaticDataHelper.getPlanetDisplayName(planetData.planetRow)).toBe("[1:1:3]");
    });

    it("returns the custom name when one is set", () =>
    {
        const planetData: CoreType.PlanetData = TestDataBuilders.buildPlanetData({ planetRow: { name: "Homeworld" } });
        expect(StaticDataHelper.getPlanetDisplayName(planetData.planetRow)).toBe("Homeworld");
    });

    it("falls back to the coordinate label for a whitespace-only name", () =>
    {
        const planetData: CoreType.PlanetData = TestDataBuilders.buildPlanetData({ planetRow: { galaxy: 1, system: 1, slot: 3, zone: GameType.PlanetZone.Planet, name: "   " } });
        expect(StaticDataHelper.getPlanetDisplayName(planetData.planetRow)).toBe("[1:1:3]");
    });
});

describe("buildable zones for the field-producing buildings", () =>
{
    it("Terraformer is buildable on a planet but not a moon", () =>
    {
        const buildableZones: GameType.PlanetZone[] = StaticDataHelper.getBuildingStats(GameType.BuildingType.Terraformer).buildableZones;
        expect(StaticDataHelper.isBuildableOnZone(buildableZones, GameType.PlanetZone.Planet)).toBe(true);
        expect(StaticDataHelper.isBuildableOnZone(buildableZones, GameType.PlanetZone.Moon)).toBe(false);
    });

    it("Lunar Base is buildable on a moon but not a planet", () =>
    {
        const buildableZones: GameType.PlanetZone[] = StaticDataHelper.getBuildingStats(GameType.BuildingType.LunarBase).buildableZones;
        expect(StaticDataHelper.isBuildableOnZone(buildableZones, GameType.PlanetZone.Moon)).toBe(true);
        expect(StaticDataHelper.isBuildableOnZone(buildableZones, GameType.PlanetZone.Planet)).toBe(false);
    });
});

describe("getDisplayNameForAddress", () =>
{
    it("uses the caller's own body name at that address", () =>
    {
        const planetData: CoreType.PlanetData = TestDataBuilders.buildPlanetData({ planetRow: { galaxy: 1, system: 2, slot: 4, zone: GameType.PlanetZone.Planet, name: "Forward Base" } });
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ planetDatas: [planetData] });

        const address: GameType.PlanetAddress = { galaxy: 1, system: 2, slot: 4, zone: GameType.PlanetZone.Planet };
        expect(StaticDataHelper.getDisplayNameForAddress(playerData, address)).toBe("Forward Base");
    });

    it("falls back to the coordinate label for an address the caller does not own", () =>
    {
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ planetDatas: [TestDataBuilders.buildPlanetData()] });

        const foreignAddress: GameType.PlanetAddress = { galaxy: 2, system: 9, slot: 1, zone: GameType.PlanetZone.Planet };
        expect(StaticDataHelper.getDisplayNameForAddress(playerData, foreignAddress)).toBe("[2:9:1]");
    });
});
