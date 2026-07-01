import { describe, it, expect } from "vitest";

import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as PlayerValueProduction from "@/lib/gameplay/coreData/formula/playerValueProductionFormulas";
import * as ResearchData from "@/lib/gameplay/dynamicData/player/researchData";
import * as TestDataBuilders from "../helpers/testDataBuilders";

function buildPlayerWithResearchLevel(researchType: GameType.ResearchType, researchLevel: number): CoreType.PlayerData
{
    const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData();
    ResearchData.setResearchLevel(playerData, researchType, researchLevel);

    return playerData;
}

describe("playerValueProductionFormulas — ProportionalOneToOne (Computer Tech)", () =>
{
    it("yields one fleet slot at level 0 and one more per level", () =>
    {
        const playerAtLevelZero: CoreType.PlayerData = buildPlayerWithResearchLevel(GameType.ResearchType.ComputerTech, 0);
        const atLevelZero: Map<GameType.PlayerValueType, CoreType.CalculatedValueData> | null = PlayerValueProduction.computeResearchPlayerValueProduction(GameType.ResearchType.ComputerTech, playerAtLevelZero);
        expect(atLevelZero).not.toBeNull();

        const fleetSlotsAtZero: CoreType.CalculatedValueData | undefined = atLevelZero!.get(GameType.PlayerValueType.FleetSlots);
        expect(fleetSlotsAtZero!.production).toBe(1);
        expect(fleetSlotsAtZero!.consumption).toBe(0);

        const playerAtLevelThree: CoreType.PlayerData = buildPlayerWithResearchLevel(GameType.ResearchType.ComputerTech, 3);
        const atLevelThree: Map<GameType.PlayerValueType, CoreType.CalculatedValueData> | null = PlayerValueProduction.computeResearchPlayerValueProduction(GameType.ResearchType.ComputerTech, playerAtLevelThree);
        const fleetSlotsAtThree: CoreType.CalculatedValueData | undefined = atLevelThree!.get(GameType.PlayerValueType.FleetSlots);
        expect(fleetSlotsAtThree!.production).toBe(4);
    });
});

describe("playerValueProductionFormulas — null paths", () =>
{
    it("returns null for a research with no player value stats", () =>
    {
        const playerData: CoreType.PlayerData = buildPlayerWithResearchLevel(GameType.ResearchType.EnergyTech, 5);
        const result: Map<GameType.PlayerValueType, CoreType.CalculatedValueData> | null = PlayerValueProduction.computeResearchPlayerValueProduction(GameType.ResearchType.EnergyTech, playerData);
        expect(result).toBeNull();
    });

    it("throws for an unknown research type", () =>
    {
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData();
        expect(() => PlayerValueProduction.computeResearchPlayerValueProduction(9999 as GameType.ResearchType, playerData)).toThrow();
    });
});
