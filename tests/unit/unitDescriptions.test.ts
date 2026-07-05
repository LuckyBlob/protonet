import { describe, it, expect } from "vitest";

import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as StaticDataHelper from "@/lib/gameplay/coreData/static/staticDataHelpers";
import * as UnitDescription from "@/lib/gameplay/coreData/description/unitDescriptions";

describe("unitDescriptions — getUnitDescriptionLines", () =>
{
	it("returns only non-empty lines for every unit type", () =>
	{
		const unitTypes: GameType.UnitType[] = Object.values(GameType.UnitType);

		for (const unitType of unitTypes)
		{
			const descriptionLines: string[] = UnitDescription.getUnitDescriptionLines(unitType);

			expect(descriptionLines.length).toBeGreaterThan(0);

			for (const descriptionLine of descriptionLines)
			{
				expect(descriptionLine.length).toBeGreaterThan(0);
			}
		}
	});

	it("shows the unit's hull value straight from its stats", () =>
	{
		const unitStats: GameType.UnitStats = StaticDataHelper.getUnitStats(GameType.UnitType.LightFighter);
		const descriptionLines: string[] = UnitDescription.getUnitDescriptionLines(GameType.UnitType.LightFighter);
		const joinedDescription: string = descriptionLines.join(" ");

		expect(joinedDescription).toContain(`Hull ${unitStats.maxHealth}`);
	});

	it("throws on an unknown unit type", () =>
	{
		const unknownUnitType: GameType.UnitType = 9999 as GameType.UnitType;

		expect((): string[] => UnitDescription.getUnitDescriptionLines(unknownUnitType)).toThrow();
	});
});
