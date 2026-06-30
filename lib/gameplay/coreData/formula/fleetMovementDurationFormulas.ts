import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as StaticDataHelper from "@/lib/gameplay/coreData/static/staticDataHelpers";
import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as FleetData from "@/lib/gameplay/dynamicData/planet/fleet/fleetData";

const COEFFICIENT: number = 10;
const SPEED_NUMERATOR: number = 3500;
const DISTANCE_FACTOR: number = 10;
const MISSILE_FLIGHT_BASE_SECONDS: number = 30;
const MISSILE_FLIGHT_SECONDS_PER_SYSTEM: number = 60;
export const FULL_SPEED_PERCENTAGE: number = 100;
export const MIN_SPEED_PERCENTAGE: number = 10;

export function clampSpeedPercentage(speedPercentage: number): number
{
	return Math.min(FULL_SPEED_PERCENTAGE, Math.max(MIN_SPEED_PERCENTAGE, speedPercentage));
}

export function computeFleetMovementDurationSecondsFromAddresses(playerData: CoreType.PlayerData, originAddress: GameType.PlanetAddress, targetAddress: GameType.PlanetAddress, unitQuantities: Map<GameType.UnitType, number>, serverData: CoreType.ServerData | null, speedPercentage: number = FULL_SPEED_PERCENTAGE): number
{
	return computeFleetMovementDurationSecondsDispatch(playerData, originAddress, targetAddress, unitQuantities, serverData, speedPercentage);
}

export function computeFleetMovementDurationSecondsWithAddress(playerData: CoreType.PlayerData, originAddress: GameType.PlanetAddress, targetAddress: GameType.PlanetAddress, unitQuantities: Map<GameType.UnitType, number>, serverData: CoreType.ServerData | null, speedPercentage: number = FULL_SPEED_PERCENTAGE): number
{
	return computeFleetMovementDurationSecondsDispatch(playerData, originAddress, targetAddress, unitQuantities, serverData, speedPercentage);
}

export function computeFleetMovementDurationSeconds(playerData: CoreType.PlayerData, originPlanetData: CoreType.PlanetData, targetPlanetData: CoreType.PlanetData, unitQuantities: Map<GameType.UnitType, number>, serverData: CoreType.ServerData | null): number
{
	const originAddress: GameType.PlanetAddress = CoreType.getPlanetAddress(originPlanetData);
	const targetAddress: GameType.PlanetAddress = CoreType.getPlanetAddress(targetPlanetData);
	return computeFleetMovementDurationSecondsWithAddress(playerData, originAddress, targetAddress, unitQuantities, serverData);
}

function computeFleetMovementDurationSecondsDispatch(playerData: CoreType.PlayerData, originAddress: GameType.PlanetAddress, targetAddress: GameType.PlanetAddress, unitQuantities: Map<GameType.UnitType, number>, serverData: CoreType.ServerData | null, speedPercentage: number): number
{
	const speedFunctionType: GameType.SpeedFunctionType = getFleetSpeedFunctionType(unitQuantities);

	switch (speedFunctionType)
	{
		case GameType.SpeedFunctionType.EngineDrive:
		{
			const distance: number = StaticDataHelper.getDistance(originAddress, targetAddress);
			const speed: number = FleetData.calculateUnitQuantitiesLowestMovementSpeed(playerData, unitQuantities);
			return computeEngineDriveDurationSeconds(distance, speed, serverData, speedPercentage);
		}
		case GameType.SpeedFunctionType.Missile:
		{
			return computeMissileFlightDurationSeconds(originAddress, targetAddress, serverData);
		}
		default:
			throw new Error(`UNREACHABLE: Missing SpeedFunctionType duration case: ${speedFunctionType}`);
	}
}

function getFleetSpeedFunctionType(unitQuantities: Map<GameType.UnitType, number>): GameType.SpeedFunctionType
{
	let resolvedSpeedFunctionType: GameType.SpeedFunctionType | undefined = undefined;
	for (const [unitType, unitQuantity] of unitQuantities)
	{
		if (unitQuantity === 0)
		{
			continue;
		}

		const unitStats: GameType.UnitStats = StaticDataHelper.getUnitStats(unitType);
		if (unitStats.speed === undefined)
		{
			throw new Error(`⚠️: Unit type ${unitType} has no speed and cannot be in a fleet.`);
		}

		if (resolvedSpeedFunctionType === undefined)
		{
			resolvedSpeedFunctionType = unitStats.speed.speedFunctionType;
		}
		else if (resolvedSpeedFunctionType !== unitStats.speed.speedFunctionType)
		{
			throw new Error(`⚠️: Fleet mixes speed function types and cannot move as one.`);
		}
	}

	if (resolvedSpeedFunctionType === undefined)
	{
		throw new Error(`⚠️: Trying to find fleet speed function type with no units.`);
	}

	return resolvedSpeedFunctionType;
}

function computeEngineDriveDurationSeconds(distance: number, speed: number, serverData: CoreType.ServerData | null, speedPercentage: number): number
{
	const timeMultiplier: number = serverData !== null ? serverData.config.time_multiplier : 1;
	const scaledSpeedNumerator: number = SPEED_NUMERATOR * FULL_SPEED_PERCENTAGE / speedPercentage;

	return Math.floor((COEFFICIENT + scaledSpeedNumerator * Math.sqrt((DISTANCE_FACTOR * distance) / speed)) / timeMultiplier);
}

function computeMissileFlightDurationSeconds(originAddress: GameType.PlanetAddress, targetAddress: GameType.PlanetAddress, serverData: CoreType.ServerData | null): number
{
	const timeMultiplier: number = serverData !== null ? serverData.config.time_multiplier : 1;
	const systemDistance: number = Math.abs(originAddress.system - targetAddress.system);
	return Math.floor((MISSILE_FLIGHT_BASE_SECONDS + MISSILE_FLIGHT_SECONDS_PER_SYSTEM * systemDistance) / timeMultiplier);
}
