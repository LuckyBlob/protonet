import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as ServerDataType from "@/lib/gameplay/gameplayData/server/serverDataTypes";
import * as AssociationMaps from "@/lib/gameplay/coreData/associationMaps";
import * as PlayerDataType from "@/lib/gameplay/gameplayData/player/playerDataTypes";
import * as FleetData from "@/lib/gameplay/gameplayData/dynamic/fleetData";

const COEFFICIENT: number = 10;
const SPEED_NUMERATOR: number = 3500;
const DISTANCE_FACTOR: number = 10;

export function computeFleetMovementDurationSeconds(originFullPlanetData: PlayerDataType.FullPlanetData, targetFullPlanetData: PlayerDataType.FullPlanetData, shipQuantities: Map<number, number>, serverData: ServerDataType.ServerData | null): number
{
	const originAddress: GameType.PlanetAddress = 
	{
		galaxy: originFullPlanetData.planetRow.galaxy,
		system: originFullPlanetData.planetRow.system,
		slot: originFullPlanetData.planetRow.slot,
	}
	const targetAddress: GameType.PlanetAddress = 
	{
		galaxy: targetFullPlanetData.planetRow.galaxy,
		system: targetFullPlanetData.planetRow.system,
		slot: targetFullPlanetData.planetRow.slot,
	}
	const distance: number = GameType.getDistance(originAddress, targetAddress);
    const speed: number = FleetData.calculateShipQuantitiesLowestMovementSpeed(shipQuantities);
	return computeFleetMovementDurationSeconds_Base(distance, speed, serverData);
}

function computeFleetMovementDurationSeconds_Base(distance: number, speed: number, serverData: ServerDataType.ServerData | null): number
{
	return COEFFICIENT + SPEED_NUMERATOR * Math.sqrt((DISTANCE_FACTOR * distance) / speed);
}