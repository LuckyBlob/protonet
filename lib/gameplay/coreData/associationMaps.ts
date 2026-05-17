import * as DBType from "@/lib/db/dbTypes";
import * as GameType from "@/lib/gameplay/gameTypes";
import * as BuildingProductionFormulas from "@/lib/gameplay/coreData/buildingProductionFormulas";
import * as PlanetData from "@/lib/playerData/planetData";

export const BUILDING_DISPLAY_NAMES: Map<number, string> = new Map<number, string>
([
	[GameType.BUILDING_1, "Iron Mine"],
	[GameType.BUILDING_2, "Crystal Mine"],
	[GameType.BUILDING_3, "Shipyard"],
]);

export const RESSOURCE_DISPLAY_NAMES: Map<number, string> = new Map<number, string>
([
	[GameType.RESSOURCE_1, "Iron"],
	[GameType.RESSOURCE_2, "Crystal"],
]);

export const STARTING_PLANET_DATA: PlanetData.DynamicPlanetData =
{
	ressourceQuantity: new Map<number, number>
	([
		[GameType.RESSOURCE_1, 2000],
		[GameType.RESSOURCE_2, 500],
	]),
	buildingLevels: new Map<number, number>
	([
	]),
};

//---- Under here is helper, dont need to update data.
export function getBuildingTypes(): number[]
{
	const buildingTypeArray: number[] = [...BUILDING_DISPLAY_NAMES.keys()];
	return buildingTypeArray;
}
