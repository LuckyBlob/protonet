import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as ServerDataType from "@/lib/gameplay/gameplayData/server/serverDataTypes";
import * as AssociationMaps from "@/lib/gameplay/coreData/associationMaps";
import * as PlayerDataType from "@/lib/gameplay/gameplayData/player/playerDataTypes";
import * as FleetData from "@/lib/gameplay/gameplayData/dynamic/fleetData";
import * as PlayerData from "@/lib/gameplay/gameplayData/player/playerData";

const COEFFICIENT: number = 10;
const SPEED_NUMERATOR: number = 3500;
const DISTANCE_FACTOR: number = 10;

export function computeFleetMovementDurationSecondsFromAddresses(originAddress: GameType.PlanetAddress, targetAddress: GameType.PlanetAddress, shipQuantities: Map<number, number>, serverData: ServerDataType.ServerData | null): number
{
	const distance: number = GameType.getDistance(originAddress, targetAddress);
	const speed: number = FleetData.calculateShipQuantitiesLowestMovementSpeed(shipQuantities);
	return computeFleetMovementDurationSeconds_Base(distance, speed, serverData);
}

export function computeFleetMovementDurationSeconds(originFullPlanetData: PlayerDataType.FullPlanetData, targetFullPlanetData: PlayerDataType.FullPlanetData, shipQuantities: Map<number, number>, serverData: ServerDataType.ServerData | null): number
{
	const originAddress: GameType.PlanetAddress = PlayerData.getPlanetAddress(originFullPlanetData);
	const targetAddress: GameType.PlanetAddress = PlayerData.getPlanetAddress(targetFullPlanetData);

	const distance: number = GameType.getDistance(originAddress, targetAddress);
    const speed: number = FleetData.calculateShipQuantitiesLowestMovementSpeed(shipQuantities);
	return computeFleetMovementDurationSeconds_Base(distance, speed, serverData);
}

function computeFleetMovementDurationSeconds_Base(distance: number, speed: number, serverData: ServerDataType.ServerData | null): number
{
	const timeMultiplier: number = serverData !== null ? serverData.config.time_multiplier : 1;
	return Math.floor((COEFFICIENT + SPEED_NUMERATOR * Math.sqrt((DISTANCE_FACTOR * distance) / speed)) / timeMultiplier);
}