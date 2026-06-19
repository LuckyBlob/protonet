import { describe, it, expect } from "vitest";

import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as ResearchPlayerValueProduction from "@/lib/gameplay/coreData/formula/researchPlayerValueProductionFormulas";

describe("researchPlayerValueProductionFormulas — ProportionalOneToOne (Computer Tech)", () =>
{
    it("yields one fleet slot at level 0 and one more per level", () =>
    {
        // factor 1, one-to-one with (level + 1): level 0 -> 1.
        const atLevelZero: Map<GameType.PlayerValueType, CoreType.CalculatedValueData> | null = ResearchPlayerValueProduction.computeResearchPlayerValueProduction(0, GameType.ResearchType.ComputerTech);
        expect(atLevelZero).not.toBeNull();

        const fleetSlotsAtZero: CoreType.CalculatedValueData | undefined = atLevelZero!.get(GameType.PlayerValueType.FleetSlots);
        expect(fleetSlotsAtZero!.production).toBe(1);
        expect(fleetSlotsAtZero!.consumption).toBe(0);

        // level 3 -> 4.
        const atLevelThree: Map<GameType.PlayerValueType, CoreType.CalculatedValueData> | null = ResearchPlayerValueProduction.computeResearchPlayerValueProduction(3, GameType.ResearchType.ComputerTech);
        const fleetSlotsAtThree: CoreType.CalculatedValueData | undefined = atLevelThree!.get(GameType.PlayerValueType.FleetSlots);
        expect(fleetSlotsAtThree!.production).toBe(4);
    });
});

describe("researchPlayerValueProductionFormulas — null paths", () =>
{
    it("returns null for a research with no player value stats", () =>
    {
        const result: Map<GameType.PlayerValueType, CoreType.CalculatedValueData> | null = ResearchPlayerValueProduction.computeResearchPlayerValueProduction(5, GameType.ResearchType.EnergyTech);
        expect(result).toBeNull();
    });

    it("returns null for an unknown research type", () =>
    {
        const result: Map<GameType.PlayerValueType, CoreType.CalculatedValueData> | null = ResearchPlayerValueProduction.computeResearchPlayerValueProduction(5, 9999 as GameType.ResearchType);
        expect(result).toBeNull();
    });
});
