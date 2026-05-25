import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as PlayerDataType from "@/lib/gameplay/gameplayData/player/playerDataTypes";
import * as DBType from "@/lib/db/dbTypes";

export type ProductionStats =
{
    minProductionPerHour: number;
    productionFactor: number;
	exponentBase: number,
};
export const BuildingCostFunctionType =
{
    SimpleProduction: 1,
    Exponential: 2,
} as const;
export type BuildingCostFunctionType = typeof BuildingCostFunctionType[keyof typeof BuildingCostFunctionType];
export type BuildingStats =
{
	costFunctionType: BuildingCostFunctionType;
	productionStats: Map<number, ProductionStats> | null;
	baseCost: Map<number, number>;
};
export const BUILDING_STATS: ReadonlyMap<number, BuildingStats> = new Map<number, BuildingStats>
([
    [GameType.BUILDING_1, {
		costFunctionType: BuildingCostFunctionType.SimpleProduction,
		productionStats: new Map<number, ProductionStats>([
			[GameType.RESOURCE_1, 
			{
				minProductionPerHour: 30,
				productionFactor: 30,
				exponentBase: 1.1,
			}]]),
		baseCost: new Map<number, number>([
			[GameType.RESOURCE_1, 60],
			[GameType.RESOURCE_2, 15],
		]),}],
    [GameType.BUILDING_2, {
		costFunctionType: BuildingCostFunctionType.SimpleProduction,
		productionStats: new Map<number, ProductionStats>([
			[GameType.RESOURCE_1, 
			{
				minProductionPerHour: 30,
				productionFactor: 30,
				exponentBase: 1.1,
			}]]),
		baseCost: new Map<number, number>([
			[GameType.RESOURCE_1, 48],
			[GameType.RESOURCE_2, 24],
		]),}],
	[GameType.BUILDING_3, {
		costFunctionType: BuildingCostFunctionType.Exponential,
		productionStats: null,
		baseCost: new Map<number, number>([
			[GameType.RESOURCE_1, 400],
			[GameType.RESOURCE_2, 200],
		]),}],
	[GameType.BUILDING_4, {
		costFunctionType: BuildingCostFunctionType.Exponential,
		productionStats: null,
		baseCost: new Map<number, number>([
			[GameType.RESOURCE_1, 400],
			[GameType.RESOURCE_2, 120],
		]),}],
]);

export const STARTING_PLANET_DATA: PlayerDataType.DynamicPlanetData =
{
	...PlayerDataType.EmptyPlanetData,
	resourceQuantity: new Map<number, number>
	([
		[GameType.RESOURCE_1, 2000],
		[GameType.RESOURCE_2, 500],
		[GameType.RESOURCE_3, 1000],
	]),
} as const;

export type ShipStats =
{
	maxHealth: number;
	speed: number;
	space: number;
	baseFuelConsumption: Map<number, number>;
	costMap: Map<number, number>;
};
export const SHIP_STATS: ReadonlyMap<number, ShipStats> = new Map<number, ShipStats>
([
    [GameType.SMALL_TRANSPORT, {
		maxHealth: 4000,
		space: 5000,
		speed: 5000,
		baseFuelConsumption: new Map<number, number>([
			[GameType.RESOURCE_3, 10]]),
		costMap: new Map<number, number>([
			[GameType.RESOURCE_1, 2000],
			[GameType.RESOURCE_2, 2000],
		]),}],
    [GameType.LARGE_TRANSPORT, {
		maxHealth: 12000,
		space: 25000,
		speed: 7500,
		baseFuelConsumption: new Map<number, number>([
			[GameType.RESOURCE_3, 50]]),
		costMap: new Map<number, number>([
			[GameType.RESOURCE_1, 6000],
			[GameType.RESOURCE_2, 6000],
		]),}],
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