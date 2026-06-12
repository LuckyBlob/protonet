import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";

export const BUILDING_STATS: ReadonlyMap<GameType.BuildingType, GameType.BuildingStats> = new Map<GameType.BuildingType, GameType.BuildingStats>
([
    [GameType.BuildingType.MetalMine, {
		displayName: "Metal Mine",
		costFunctionType: GameType.BuildingCostFunctionType.SimpleExponential,
		costStats: {
			baseCostExponent: 1.5,
			baseCost: new Map<number, number>([
				[GameType.ResourceType.Metal, 60],
				[GameType.ResourceType.Crystal, 15],]),},
		productionFunctionType: GameType.ProductionFunctionType.SimpleProductionBuilding,
		productionStats: new Map<number, GameType.ProductionStats>([
			[GameType.ResourceType.Metal, {
				minProductionPerHour: 30,
				productionFactor: 30,
				exponentBase: 1.1,}]]),
		planetValueProductionFormulasType: GameType.BuildingPlanetValueProductionFormulasType.SimpleExponential,
		planetValueStats: {
			basePlanetValueExponent: 1.1,
			basePlanetValueFactor: new Map<number, number>([
				[GameType.PlanetValueType.Energy, -10],]),},}],
	[GameType.BuildingType.CrystalGrower, {
		displayName: "Crystal Grower",
		costFunctionType: GameType.BuildingCostFunctionType.SimpleExponential,
		costStats: {
			baseCostExponent: 1.6,
			baseCost: new Map<number, number>([
				[GameType.ResourceType.Metal, 48],
				[GameType.ResourceType.Crystal, 24],]),},
		productionFunctionType: GameType.ProductionFunctionType.SimpleProductionBuilding,
		productionStats: new Map<number, GameType.ProductionStats>([
			[GameType.ResourceType.Crystal, {
				minProductionPerHour: 15,
				productionFactor: 20,
				exponentBase: 1.1,}]]),
		planetValueProductionFormulasType: GameType.BuildingPlanetValueProductionFormulasType.SimpleExponential,
		planetValueStats: {
			basePlanetValueExponent: 1.1,
			basePlanetValueFactor: new Map<number, number>([
				[GameType.PlanetValueType.Energy, -10],]),},}],
	[GameType.BuildingType.DeuteriumSynthesizer, {
		displayName: "Deuterium Synthesizer",
		costFunctionType: GameType.BuildingCostFunctionType.SimpleExponential,
		costStats: {
			baseCostExponent: 2,
			baseCost: new Map<number, number>([
				[GameType.ResourceType.Metal, 225],
				[GameType.ResourceType.Crystal, 75],]),},
		productionFunctionType: GameType.ProductionFunctionType.SimpleProductionBuilding,
		productionStats: new Map<number, GameType.ProductionStats>([
			[GameType.ResourceType.Deuterium, {
				minProductionPerHour: 0,
				productionFactor: 10,
				exponentBase: 1.1,}]]),
		planetValueProductionFormulasType: GameType.BuildingPlanetValueProductionFormulasType.SimpleExponential,
		planetValueStats: {
			basePlanetValueExponent: 1.1,
			basePlanetValueFactor: new Map<number, number>([
				[GameType.PlanetValueType.Energy, -20],]),},}],
	[GameType.BuildingType.SolarPlant, {
		displayName: "Solar Plant",
		costFunctionType: GameType.BuildingCostFunctionType.SimpleExponential,
		costStats: {
			baseCostExponent: 1.5,
			baseCost: new Map<number, number>([
				[GameType.ResourceType.Metal, 75],
				[GameType.ResourceType.Crystal, 30],]),},
		planetValueProductionFormulasType: GameType.BuildingPlanetValueProductionFormulasType.SimpleExponential,
		planetValueStats: {
			basePlanetValueExponent: 1.1,
			basePlanetValueFactor: new Map<number, number>([
				[GameType.PlanetValueType.Energy, 20],]),},}],
	[GameType.BuildingType.Shipyard, {
		displayName: "Shipyard",
		costFunctionType: GameType.BuildingCostFunctionType.SimpleExponential,
		costStats: {
			baseCostExponent: 2,
			baseCost: new Map<number, number>([
				[GameType.ResourceType.Metal, 400],
				[GameType.ResourceType.Crystal, 200],]),},},],
	[GameType.BuildingType.RoboticFactory, {
		displayName: "Robotic Factory",
		costFunctionType: GameType.BuildingCostFunctionType.SimpleExponential,
		costStats: {
			baseCostExponent: 1.5,
			baseCost: new Map<number, number>([
				[GameType.ResourceType.Metal, 400],
				[GameType.ResourceType.Crystal, 120],]),},},],
]);

export const SHIP_STATS: ReadonlyMap<GameType.ShipType, GameType.ShipStats> = new Map<GameType.ShipType, GameType.ShipStats>
([
    [GameType.ShipType.SmallTransport, {
		displayName: "Small Transport",
		maxHealth: 4000,
		space: 5000,
		speed: 5000,
		baseFuelConsumption: new Map<number, number>([
			[GameType.ResourceType.Deuterium, 10]]),
		costMap: new Map<number, number>([
			[GameType.ResourceType.Metal, 2000],
			[GameType.ResourceType.Crystal, 2000],]),}],
    [GameType.ShipType.LargeTransport, {
		displayName: "Large Transport",
		maxHealth: 12000,
		space: 25000,
		speed: 7500,
		baseFuelConsumption: new Map<number, number>([
			[GameType.ResourceType.Deuterium, 50]]),
		costMap: new Map<number, number>([
			[GameType.ResourceType.Metal, 6000],
			[GameType.ResourceType.Crystal, 6000],]),}],
    [GameType.ShipType.ColonyShip, {
		displayName: "Colony Ship",
		maxHealth: 30000,
		space: 2500,
		speed: 7500,
		baseFuelConsumption: new Map<number, number>([
			[GameType.ResourceType.Deuterium, 1000]]),
		costMap: new Map<number, number>([
			[GameType.ResourceType.Metal, 10000],
			[GameType.ResourceType.Crystal, 20000],
			[GameType.ResourceType.Deuterium, 10000],]),}],
]);

export const RESOURCE_INFOS: ReadonlyMap<GameType.ResourceType, GameType.ResourceInfo> = new Map<GameType.ResourceType, GameType.ResourceInfo>
([
    [GameType.ResourceType.Metal, {
		displayName: "Metal",}],
	[GameType.ResourceType.Crystal, {
		displayName: "Crystal",}],
	[GameType.ResourceType.Deuterium, {
		displayName: "Deuterium",}],
]);

export const FLEET_ACTION_INFOS: ReadonlyMap<GameType.FleetActionType, GameType.FleetActionInfo> = new Map<GameType.FleetActionType, GameType.FleetActionInfo>
([
    [GameType.FleetActionType.Station, {
		displayName: "Station",}],
	[GameType.FleetActionType.Collect, {
		displayName: "Collect",}],
	[GameType.FleetActionType.Colonize, {
		displayName: "Colonize",}],
]);

export const PLANET_VALUE_INFOS: ReadonlyMap<GameType.PlanetValueType, GameType.PlanetValueInfo> = new Map<GameType.PlanetValueType, GameType.PlanetValueInfo>
([
    [GameType.PlanetValueType.Energy, {
		displayName: "Energy",
		showInTopBar: true,
		ratioImpactsResourceProduction: true}],
]);

export const STARTING_PLANET_DATA: CoreType.DynamicPlanetData =
{
	...structuredClone(CoreType.EmptyPlanetData),
	resourceQuantity: new Map<number, number>
	([
		[GameType.ResourceType.Metal, 2000],
		[GameType.ResourceType.Crystal, 500],
		[GameType.ResourceType.Deuterium, 0],
	]),
} as const;

export const SLOT_SIZE_RANGES: GameType.SlotSizeRange[] =
[
    { min: 40,  max: 70  },  // slot 1
    { min: 120, max: 310 },  // slot 2
    { min: 125, max: 255 },  // slot 3
    { min: 75,  max: 125 },  // slot 4
    { min: 60,  max: 90  },  // slot 5
];
export const GALAXY_DISTANCE: number = 20000;
export const SYSTEM_DISTANCE: number = 2700;
export const SYSTEM_DISTANCE_FACTOR: number = 95;
export const SLOT_DISTANCE: number = 1000;
export const SLOT_DISTANCE_FACTOR: number = 55;
export const MAX_ALLOWED_PLANETS: number = 9;

export const GALAXY_COUNT: number = 2;

export const SYSTEM_COUNT: number = 20;
export const SLOT_COUNT: number = 5;
export const MIN_SLOT_STARTING_PLANET: number = 3;
export const MAX_SLOT_STARTING_PLANET: number = 4;
export const STARTING_PLANET_SIZE: number = 163;