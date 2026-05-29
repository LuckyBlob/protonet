import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";

export const GALAXY_COUNT: number = 2;
export const SYSTEM_COUNT: number = 20;
export const SLOT_COUNT: number = 5;
export const MIN_SLOT_STARTING_PLANET: number = 3;
export const MAX_SLOT_STARTING_PLANET: number = 4;
export const STARTING_PLANET_SIZE: number = 163;

type SlotSizeRange =
{
	min: number;
	max: number;
};
const SLOT_SIZE_RANGES: SlotSizeRange[] =
[
	{ min: 40,  max: 70  },  // slot 1
	{ min: 120, max: 310 },  // slot 2
	{ min: 125, max: 255 },  // slot 3
	{ min: 75,  max: 125 },  // slot 4
	{ min: 60,  max: 90  },  // slot 5
];
export function rollSizeForSlot(slot: number): number
{
	const range: SlotSizeRange = SLOT_SIZE_RANGES[slot - 1];
	const span: number = range.max - range.min;
	const rolledSize: number = range.min + Math.floor(Math.random() * (span + 1));
	return rolledSize;
}

export const BUILDING_RESOURCE_PRODUCTION_1: number = 1; // prod resource 1
export const BUILDING_RESOURCE_PRODUCTION_2: number = 2; // prod resource 1
export const BUILDING_SHIPYARD: number = 3; // shipyard
export const BUILDING_ROBOTIC_FACTORY: number = 4; // Robotic factory
export const BUILDING_RESOURCE_PRODUCTION_3: number = 5; // prod resource 3

export const BUILDING_DISPLAY_NAMES: ReadonlyMap<number, string> = new Map<number, string>
([
    [BUILDING_RESOURCE_PRODUCTION_1, "Iron Mine"],
    [BUILDING_RESOURCE_PRODUCTION_2, "Crystal Mine"],
    [BUILDING_SHIPYARD, "Shipyard"],
    [BUILDING_ROBOTIC_FACTORY, "Robotics Factory"],
    [BUILDING_RESOURCE_PRODUCTION_3, "Deuterium Synthesizer"],
]);

export const RESOURCE_1: number = 1;
export const RESOURCE_2: number = 2;
export const RESOURCE_3: number = 3;

export const RESOURCE_DISPLAY_NAMES: ReadonlyMap<number, string> = new Map<number, string>
([
    [RESOURCE_1, "Iron"],
    [RESOURCE_2, "Crystal"],
    [RESOURCE_3, "Deuterium"],
]);

export const SMALL_TRANSPORT: number = 1;
export const LARGE_TRANSPORT: number = 2;
export const COLONY_SHIP: number = 3;

export const SHIP_DISPLAY_NAMES: ReadonlyMap<number, string> = new Map<number, string>
([
    [SMALL_TRANSPORT, "Small Transport"],
    [LARGE_TRANSPORT, "Large Transport"],
]);

export const FLEET_ACTION_STATION: number = 1; // Go to planet and stay there
export const FLEET_ACTION_TRANSPORT: number = 2; // Drop off resources and/or ships on target planet and go back to origin planet
export const FLEET_ACTION_COLONIZE: number = 3; // go to unclaimed planet and colonize it, turning it into a new planet owned by the player
export const FLEET_ACTION_COLLECT: number = 4; // go to planet, collect resources and/or ships, and go back to origin planet) - fails if there are enemy ships on the target planet

export const FLEET_ACTION_NAMES: ReadonlyMap<number, string> = new Map<number, string>
([
    [FLEET_ACTION_STATION, "Station"],
    [FLEET_ACTION_TRANSPORT, "Transport"],
    [FLEET_ACTION_COLONIZE, "Colonize"],
    [FLEET_ACTION_COLLECT, "Collect"],
]);

const GALAXY_DISTANCE: number = 20000;
const SYSTEM_DISTANCE: number = 2700;
const SYSTEM_DISTANCE_FACTOR: number = 95;
const SLOT_DISTANCE: number = 1000;
const SLOT_DISTANCE_FACTOR: number = 55;
export type PlanetAddress =
{
    galaxy: number,
    system: number,
    slot: number
}
export function getDistance(origin: PlanetAddress, target: PlanetAddress): number
{
    const galaxyDifference: number = Math.abs(origin.galaxy - target.galaxy);
    if (galaxyDifference !== 0)
    {
        return galaxyDifference * GALAXY_DISTANCE;
    }

    const systemDifference: number = Math.abs(origin.system - target.system);
    if (systemDifference !== 0)
    {
        return SYSTEM_DISTANCE + systemDifference * SYSTEM_DISTANCE_FACTOR;
    }

    const slotDifference: number = Math.abs(origin.slot - target.slot);
    if (slotDifference !== 0)
    {
        return SLOT_DISTANCE + slotDifference * SLOT_DISTANCE_FACTOR;
    }

    return 0;
}

export function isSameAddress(origin: PlanetAddress, target: PlanetAddress): boolean
{
    return (origin.galaxy === target.galaxy) && (origin.system === target.system) && (origin.slot === target.slot)
}

export type ProductionStats =
{
    minProductionPerHour: number;
    productionFactor: number;
	exponentBase: number,
};
export const BuildingCostFunctionType =
{
    SimpleExponential: 1,
} as const;
export type BuildingCostFunctionType = typeof BuildingCostFunctionType[keyof typeof BuildingCostFunctionType];
export type BuildingStats =
{
	costFunctionType: BuildingCostFunctionType;
	productionStats: Map<number, ProductionStats> | null;
	baseCostExponent: number;
	baseCost: Map<number, number>;
};
export const BUILDING_STATS: ReadonlyMap<number, BuildingStats> = new Map<number, BuildingStats>
([
    [BUILDING_RESOURCE_PRODUCTION_1, {
		costFunctionType: BuildingCostFunctionType.SimpleExponential,
		productionStats: new Map<number, ProductionStats>([
			[RESOURCE_1, 
			{
				minProductionPerHour: 30,
				productionFactor: 30,
				exponentBase: 1.1,
			}]]),
		baseCostExponent: 1.5,
		baseCost: new Map<number, number>([
			[RESOURCE_1, 60],
			[RESOURCE_2, 15],
		]),}],
    [BUILDING_RESOURCE_PRODUCTION_2, {
		costFunctionType: BuildingCostFunctionType.SimpleExponential,
		productionStats: new Map<number, ProductionStats>([
			[RESOURCE_2,
			{
				minProductionPerHour: 15,
				productionFactor: 20,
				exponentBase: 1.1,
			}]]),
		baseCostExponent: 1.6,
		baseCost: new Map<number, number>([
			[RESOURCE_1, 48],
			[RESOURCE_2, 24],
		]),}],
	[BUILDING_SHIPYARD, {
		costFunctionType: BuildingCostFunctionType.SimpleExponential,
		productionStats: null,
		baseCostExponent: 2,
		baseCost: new Map<number, number>([
			[RESOURCE_1, 400],
			[RESOURCE_2, 200],
		]),}],
	[BUILDING_ROBOTIC_FACTORY, {
		costFunctionType: BuildingCostFunctionType.SimpleExponential,
		productionStats: null,
		baseCostExponent: 1.5,
		baseCost: new Map<number, number>([
			[RESOURCE_1, 400],
			[RESOURCE_2, 120],
		]),}],
	[BUILDING_RESOURCE_PRODUCTION_3, {
		costFunctionType: BuildingCostFunctionType.SimpleExponential,
		productionStats: new Map<number, ProductionStats>([
			[RESOURCE_3, 
			{
				minProductionPerHour: 0,
				productionFactor: 10,
				exponentBase: 1.1,
			}]]),
		baseCostExponent: 2,
		baseCost: new Map<number, number>([
			[RESOURCE_1, 225],
			[RESOURCE_2, 75],
		]),}],
]);

export const STARTING_PLANET_DATA: CoreType.DynamicPlanetData =
{
	...CoreType.EmptyPlanetData,
	resourceQuantity: new Map<number, number>
	([
		[RESOURCE_1, 2000],
		[RESOURCE_2, 500],
		[RESOURCE_3, 0],
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
    [SMALL_TRANSPORT, {
		maxHealth: 4000,
		space: 5000,
		speed: 5000,
		baseFuelConsumption: new Map<number, number>([
			[RESOURCE_3, 10]]),
		costMap: new Map<number, number>([
			[RESOURCE_1, 2000],
			[RESOURCE_2, 2000],
		]),}],
    [LARGE_TRANSPORT, {
		maxHealth: 12000,
		space: 25000,
		speed: 7500,
		baseFuelConsumption: new Map<number, number>([
			[RESOURCE_3, 50]]),
		costMap: new Map<number, number>([
			[RESOURCE_1, 6000],
			[RESOURCE_2, 6000],
		]),}],
]);