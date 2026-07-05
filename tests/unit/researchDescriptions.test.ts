import { describe, it, expect } from "vitest";

import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as ResearchDescription from "@/lib/gameplay/coreData/description/researchDescriptions";
import * as CombatResearch from "@/lib/gameplay/coreData/formula/combatResearchFunctions";

describe("researchDescriptionFormulas — getResearchDescriptionLines", () =>
{
	it("returns only non-empty lines for every research type", () =>
	{
		const researchTypes: GameType.ResearchType[] = Object.values(GameType.ResearchType);

		for (const researchType of researchTypes)
		{
			const descriptionLines: string[] = ResearchDescription.getResearchDescriptionLines(researchType);

			expect(descriptionLines.length).toBeGreaterThan(0);

			for (const descriptionLine of descriptionLines)
			{
				expect(descriptionLine.length).toBeGreaterThan(0);
			}
		}
	});

	it("derives the weapon-power rule from the combat research constant", () =>
	{
		const expectedBonusPercent: number = Math.round(CombatResearch.COMBAT_RESEARCH_BONUS_PER_LEVEL * 100);
		const descriptionLines: string[] = ResearchDescription.getResearchDescriptionLines(GameType.ResearchType.WeaponTech);
		const joinedDescription: string = descriptionLines.join(" ");

		expect(joinedDescription).toContain(`${expectedBonusPercent}%`);
	});

	it("throws on an unknown research type", () =>
	{
		const unknownResearchType: GameType.ResearchType = 9999 as GameType.ResearchType;

		expect((): string[] => ResearchDescription.getResearchDescriptionLines(unknownResearchType)).toThrow();
	});
});
