import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as StaticDataHelper from "@/lib/gameplay/coreData/static/staticDataHelpers";
import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as FleetData from "@/lib/gameplay/dynamicData/planet/fleet/fleetData";

const COEFFICIENT: number = 10;
const SPEED_NUMERATOR: number = 3500;
const DISTANCE_FACTOR: number = 10;

export function computeFleetMovementDurationSecondsFromAddresses(originAddress: GameType.PlanetAddress, targetAddress: GameType.PlanetAddress, shipQuantities: Map<number, number>, serverData: CoreType.ServerData | null): number
{
	const distance: number = StaticDataHelper.getDistance(originAddress, targetAddress);
	const speed: number = FleetData.calculateShipQuantitiesLowestMovementSpeed(shipQuantities);
	return computeFleetMovementDurationSeconds_Base(distance, speed, serverData);
}

export function computeFleetMovementDurationSecondsWithAddress(originAddress: GameType.PlanetAddress, targetAddress: GameType.PlanetAddress, shipQuantities: Map<number, number>, serverData: CoreType.ServerData | null): number
{
	const distance: number = StaticDataHelper.getDistance(originAddress, targetAddress);
    const speed: number = FleetData.calculateShipQuantitiesLowestMovementSpeed(shipQuantities);
	return computeFleetMovementDurationSeconds_Base(distance, speed, serverData);
}

export function computeFleetMovementDurationSeconds(originPlanetData: CoreType.PlanetData, targetPlanetData: CoreType.PlanetData, shipQuantities: Map<number, number>, serverData: CoreType.ServerData | null): number
{
	const originAddress: GameType.PlanetAddress = CoreType.getPlanetAddress(originPlanetData);
	const targetAddress: GameType.PlanetAddress = CoreType.getPlanetAddress(targetPlanetData);
	return computeFleetMovementDurationSecondsWithAddress(originAddress, targetAddress, shipQuantities, serverData);
}

function computeFleetMovementDurationSeconds_Base(distance: number, speed: number, serverData: CoreType.ServerData | null): number
{
	const timeMultiplier: number = serverData !== null ? serverData.config.time_multiplier : 1;
	return Math.floor((COEFFICIENT + SPEED_NUMERATOR * Math.sqrt((DISTANCE_FACTOR * distance) / speed)) / timeMultiplier);
}