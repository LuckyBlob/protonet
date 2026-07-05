import { describe, it, expect } from "vitest";

import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as BuildingDescription from "@/lib/gameplay/coreData/description/buildingDescriptions";

describe("buildingDescriptions — getBuildingDescriptionLines", () =>
{
	it("returns only non-empty lines for every building type", () =>
	{
		const buildingTypes: GameType.BuildingType[] = Object.values(GameType.BuildingType);

		for (const buildingType of buildingTypes)
		{
			const descriptionLines: string[] = BuildingDescription.getBuildingDescriptionLines(buildingType);

			expect(descriptionLines.length).toBeGreaterThan(0);

			for (const descriptionLine of descriptionLines)
			{
				expect(descriptionLine.length).toBeGreaterThan(0);
			}
		}
	});

	it("throws on an unknown building type", () =>
	{
		const unknownBuildingType: GameType.BuildingType = 9999 as GameType.BuildingType;

		expect((): string[] => BuildingDescription.getBuildingDescriptionLines(unknownBuildingType)).toThrow();
	});
});
