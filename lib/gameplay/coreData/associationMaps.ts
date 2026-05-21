import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as PlayerDataType from "@/lib/gameplay/gameplayData/player/playerDataTypes";
import * as DBType from "@/lib/db/dbTypes";

export const BUILDING_1_DATA: SimpleProductionBuildingCostData =
{
	baseCostMap: new Map<number, number>
	([
		[GameType.RESOURCE_1, 60],
		[GameType.RESOURCE_2, 15],
	]),
	growthFactor: 1.5,
};
export const BUILDING_2_DATA: SimpleProductionBuildingCostData =
{
	baseCostMap: new Map<number, number>
	([
		[GameType.RESOURCE_1, 48],
		[GameType.RESOURCE_2, 24],
	]),
	growthFactor: 1.6,
};
export const BUILDING_3_DATA: ExponentialBuildingCostData =
{
	baseCostMap: new Map<number, number>
	([
		[GameType.RESOURCE_1, 400],
		[GameType.RESOURCE_2, 200],
	]),
	exponentBase: 2,
};
export const BUILDING_4_DATA: ExponentialBuildingCostData =
{
	baseCostMap: new Map<number, number>
	([
		[GameType.RESOURCE_1, 400],
		[GameType.RESOURCE_2, 120],
	]),
	exponentBase: 2,
};


export const STARTING_PLANET_DATA: PlayerDataType.DynamicPlanetData =
{
	...PlayerDataType.EmptyPlanetData,
	resourceQuantity: new Map<number, number>
	([
		[GameType.RESOURCE_1, 2000],
		[GameType.RESOURCE_2, 500],
	]),
} as const;

export const SHIP_MAX_HEALTH: ReadonlyMap<number, number> = new Map<number, number>
([
	[GameType.SHIP_1, 4000],
	[GameType.SHIP_2, 12000],
]);

export const SHIP_COST: ReadonlyMap<number, Map<number, number>> = new Map<number, Map<number, number>>
([
	[GameType.SHIP_1, new Map<number, number>
	([
		[GameType.RESOURCE_1, 2000],
		[GameType.RESOURCE_2, 2000],
	])],
	[GameType.SHIP_2, new Map<number, number>
	([
		[GameType.RESOURCE_1, 6000],
		[GameType.RESOURCE_2, 6000],
	])],
]);

export const STARTING_PLANET_SIZE: number = 163;

export const CLEAN_PLANET: Partial<DBType.PlanetRow> =
{
	owner_player_id: null,
	building_upgrade_completes_at: 0,
	building_being_upgraded: 0,
	ship_construction_batch_completes_at: 0,
	current_ship_construction_batch_id: 0,
};

//#region Building Cost Production Types
export type SimpleProductionBuildingCostData =
{
	baseCostMap: Map<number, number>;
	growthFactor: number;
};

export type ExponentialBuildingCostData =
{
	baseCostMap: Map<number, number>;
	exponentBase: number;
};
//#endregion