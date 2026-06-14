import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as ThingType from "@/lib/gameplay/coreData/type/thingTypes";
import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as MathHelp from "@/lib/helper/mathHelp";

// #region Ship Management
export function setShipQuantity(planetData: CoreType.PlanetData, shipType: GameType.ShipType, value: number): void
{
	ThingType.setSpecificThingValue(planetData, CoreType.DataContext.ShipQuantity, shipType, value);
}

export function getShipQuantity(planetData: CoreType.PlanetData, shipType: GameType.ShipType): number
{
	const shipQuantities: Map<GameType.ShipType, number> = ThingType.getThingValues(planetData, CoreType.DataContext.ShipQuantity) as Map<GameType.ShipType, number>;
	return shipQuantities.get(shipType) ?? 0;
}

export function hasShipQuantities(planetData: CoreType.PlanetData, shipQuantities: Map<GameType.ShipType, number>): boolean
{
	return MathHelp.hasQuantities(shipQuantities, (type: GameType.ShipType): number | undefined => { return getShipQuantity(planetData, type) });
}

export function hasShips(planetData: CoreType.PlanetData): boolean
{
	const shipQuantities: Map<GameType.ShipType, number> = ThingType.getThingValues(planetData, CoreType.DataContext.ShipQuantity) as Map<GameType.ShipType, number>;
	for (const [shipType, shipQuantity] of shipQuantities)
	{
		if (shipQuantity > 0)
		{
			return true;
		}
	}

	return false;
}

export function subtractPlanetShips(planetData: CoreType.PlanetData, shipQuantities: Map<GameType.ShipType, number>): Map<GameType.ShipType, number>
{
	return MathHelp.subtractQuantities(shipQuantities,
									  (type: GameType.ShipType): number | undefined => { return getShipQuantity(planetData, type) },
									  (type: GameType.ShipType, value: number): void => { setShipQuantity(planetData, type, value) });
}

export function subtractPlanetShip(planetData: CoreType.PlanetData, shipType: GameType.ShipType, amountToSubtract: number): number
{
	return MathHelp.subtractQuantity(shipType, amountToSubtract,
									(type: GameType.ShipType): number | undefined => { return getShipQuantity(planetData, type) },
									(type: GameType.ShipType, value: number): void => { setShipQuantity(planetData, type, value) });
}

export function addPlanetShips(planetData: CoreType.PlanetData, shipQuantities: Map<GameType.ShipType, number>): Map<GameType.ShipType, number>
{
	return MathHelp.addQuantities(shipQuantities,
								 (type: GameType.ShipType): number | undefined => { return getShipQuantity(planetData, type) },
								 (type: GameType.ShipType, value: number): void => { setShipQuantity(planetData, type, value) });
}

export function addPlanetShip(planetData: CoreType.PlanetData, shipType: GameType.ShipType, amountToAdd: number): number
{
	return MathHelp.addQuantity(shipType, amountToAdd,
							   (type: GameType.ShipType): number | undefined => { return getShipQuantity(planetData, type) },
							   (type: GameType.ShipType, value: number): void => { setShipQuantity(planetData, type, value) });
}
// #endregion
