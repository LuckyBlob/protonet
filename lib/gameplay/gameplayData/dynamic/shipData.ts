import * as AssociationMaps from "@/lib/gameplay/coreData/associationMaps";
import * as ResourceData from "@/lib/gameplay/gameplayData/dynamic/resourceData";
import * as ServerDataType from "@/lib/gameplay/gameplayData/server/serverDataTypes";
import * as ShipConstruction from "@/lib/gameplay/coreData/formula/shipConstructionFormulas";
import * as PlayerDataType from "@/lib/gameplay/gameplayData/player/playerDataTypes";
import * as BuildingData from "@/lib/gameplay/gameplayData/dynamic/buildingData";
import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as ThingType from "@/lib/gameplay/coreData/type/thingTypes";
import * as APIEndPoint from "@/app/api/apiEndPoints";
import * as ShipFuelConsumption from "@/lib/gameplay/coreData/formula/shipFuelConsumptionFormulas";
import * as RequestType from "@/lib/networkRequests/requestTypes";
import * as MathHelp from "@/lib/helper/mathHelp";

// #region Ship Management
export function setShipQuantity(fullPlanetData: PlayerDataType.FullPlanetData, shipType: number, value: number): void
{
	ThingType.setSpecificThingValue(fullPlanetData, PlayerDataType.DataContext.ShipQuantity, shipType, value);
}

export function getShipQuantity(fullPlanetData: PlayerDataType.FullPlanetData, shipType: number): number
{
	const shipQuantities: Map<ThingType.SpecificThing, number> = ThingType.getThingValues(fullPlanetData, PlayerDataType.DataContext.ShipQuantity);
	return shipQuantities.get(shipType) ?? 0;
}

export function hasShipQuantities(fullPlanetData: PlayerDataType.FullPlanetData, shipQuantities: Map<number, number>): boolean
{
	return MathHelp.hasQuantities(shipQuantities, (type: number): number | undefined => { return getShipQuantity(fullPlanetData, type) });
}

export function hasShips(fullPlanetData: PlayerDataType.FullPlanetData): boolean
{
	const shipQuantities: Map<ThingType.SpecificThing, number> = ThingType.getThingValues(fullPlanetData, PlayerDataType.DataContext.ShipQuantity);
	for (const [shipType, shipQuantity] of shipQuantities)
	{
		if (shipQuantity > 0)
		{
			return true;
		}
	}

	return false;
}

export function subtractPlanetShips(fullPlanetData: PlayerDataType.FullPlanetData, shipQuantities: Map<number, number>): Map<number, number>
{
	return MathHelp.subtractQuantities(shipQuantities,
									  (type: number): number | undefined => { return getShipQuantity(fullPlanetData, type) },
									  (type: number, value: number): void => { setShipQuantity(fullPlanetData, type, value) });
}

export function subtractPlanetShip(fullPlanetData: PlayerDataType.FullPlanetData, shipType: number, amountToSubtract: number): number
{
	return MathHelp.subtractQuantity(shipType, amountToSubtract,
									(type: number): number | undefined => { return getShipQuantity(fullPlanetData, type) },
									(type: number, value: number): void => { setShipQuantity(fullPlanetData, type, value) });
}

export function addPlanetShips(fullPlanetData: PlayerDataType.FullPlanetData, shipQuantities: Map<number, number>): Map<number, number>
{
	return MathHelp.addQuantities(shipQuantities,
								 (type: number): number | undefined => { return getShipQuantity(fullPlanetData, type) },
								 (type: number, value: number): void => { setShipQuantity(fullPlanetData, type, value) });
}

export function addPlanetShip(fullPlanetData: PlayerDataType.FullPlanetData, shipType: number, amountToAdd: number): number
{
	return MathHelp.addQuantity(shipType, amountToAdd,
							   (type: number): number | undefined => { return getShipQuantity(fullPlanetData, type) },
							   (type: number, value: number): void => { setShipQuantity(fullPlanetData, type, value) });
}
// #endregion