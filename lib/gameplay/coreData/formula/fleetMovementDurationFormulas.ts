import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as StaticDataHelper from "@/lib/gameplay/coreData/static/staticDataHelpers";
import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as FleetData from "@/lib/gameplay/dynamicData/planet/fleet/fleetData";

const COEFFICIENT: number = 10;
const SPEED_NUMERATOR: number = 3500;
const DISTANCE_FACTOR: number = 10;
export const FULL_SPEED_PERCENTAGE: number = 100;
export const MIN_SPEED_PERCENTAGE: number = 10;

export function clampSpeedPercentage(speedPercentage: number): number
{
	return Math.min(FULL_SPEED_PERCENTAGE, Math.max(MIN_SPEED_PERCENTAGE, speedPercentage));
}

export function computeFleetMovementDurationSecondsFromAddresses(playerData: CoreType.PlayerData, originAddress: GameType.PlanetAddress, targetAddress: GameType.PlanetAddress, unitQuantities: Map<GameType.UnitType, number>, serverData: CoreType.ServerData | null, speedPercentage: number = FULL_SPEED_PERCENTAGE): number
{
	const distance: number = StaticDataHelper.getDistance(originAddress, targetAddress);
	const speed: number = FleetData.calculateUnitQuantitiesLowestMovementSpeed(playerData, unitQuantities);
	return computeFleetMovementDurationSeconds_Base(distance, speed, serverData, speedPercentage);
}

export function computeFleetMovementDurationSecondsWithAddress(playerData: CoreType.PlayerData, originAddress: GameType.PlanetAddress, targetAddress: GameType.PlanetAddress, unitQuantities: Map<GameType.UnitType, number>, serverData: CoreType.ServerData | null, speedPercentage: number = FULL_SPEED_PERCENTAGE): number
{
	const distance: number = StaticDataHelper.getDistance(originAddress, targetAddress);
	const speed: number = FleetData.calculateUnitQuantitiesLowestMovementSpeed(playerData, unitQuantities);
	return computeFleetMovementDurationSeconds_Base(distance, speed, serverData, speedPercentage);
}

export function computeFleetMovementDurationSeconds(playerData: CoreType.PlayerData, originPlanetData: CoreType.PlanetData, targetPlanetData: CoreType.PlanetData, unitQuantities: Map<GameType.UnitType, number>, serverData: CoreType.ServerData | null): number
{
	const originAddress: GameType.PlanetAddress = CoreType.getPlanetAddress(originPlanetData);
	const targetAddress: GameType.PlanetAddress = CoreType.getPlanetAddress(targetPlanetData);
	return computeFleetMovementDurationSecondsWithAddress(playerData, originAddress, targetAddress, unitQuantities, serverData);
}

function computeFleetMovementDurationSeconds_Base(distance: number, speed: number, serverData: CoreType.ServerData | null, speedPercentage: number): number
{
	const timeMultiplier: number = serverData !== null ? serverData.config.time_multiplier : 1;
	const scaledSpeedNumerator: number = SPEED_NUMERATOR * FULL_SPEED_PERCENTAGE / speedPercentage;

	return Math.floor((COEFFICIENT + scaledSpeedNumerator * Math.sqrt((DISTANCE_FACTOR * distance) / speed)) / timeMultiplier);
}