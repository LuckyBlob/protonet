import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as ThingType from "@/lib/gameplay/coreData/type/thingTypes";
import * as MathHelp from "@/lib/helper/mathHelp";

// #region Ship Management
export function setShipQuantity(planetData: CoreType.PlanetData, shipType: number, value: number): void
{
	ThingType.setSpecificThingValue(planetData, CoreType.DataContext.ShipQuantity, shipType, value);
}

export function getShipQuantity(planetData: CoreType.PlanetData, shipType: number): number
{
	const shipQuantities: Map<ThingType.SpecificThing, number> = ThingType.getThingValues(planetData, CoreType.DataContext.ShipQuantity);
	return shipQuantities.get(shipType) ?? 0;
}

export function hasShipQuantities(planetData: CoreType.PlanetData, shipQuantities: Map<number, number>): boolean
{
	return MathHelp.hasQuantities(shipQuantities, (type: number): number | undefined => { return getShipQuantity(planetData, type) });
}

export function hasShips(planetData: CoreType.PlanetData): boolean
{
	const shipQuantities: Map<ThingType.SpecificThing, number> = ThingType.getThingValues(planetData, CoreType.DataContext.ShipQuantity);
	for (const [shipType, shipQuantity] of shipQuantities)
	{
		if (shipQuantity > 0)
		{
			return true;
		}
	}

	return false;
}

export function subtractPlanetShips(planetData: CoreType.PlanetData, shipQuantities: Map<number, number>): Map<number, number>
{
	return MathHelp.subtractQuantities(shipQuantities,
									  (type: number): number | undefined => { return getShipQuantity(planetData, type) },
									  (type: number, value: number): void => { setShipQuantity(planetData, type, value) });
}

export function subtractPlanetShip(planetData: CoreType.PlanetData, shipType: number, amountToSubtract: number): number
{
	return MathHelp.subtractQuantity(shipType, amountToSubtract,
									(type: number): number | undefined => { return getShipQuantity(planetData, type) },
									(type: number, value: number): void => { setShipQuantity(planetData, type, value) });
}

export function addPlanetShips(planetData: CoreType.PlanetData, shipQuantities: Map<number, number>): Map<number, number>
{
	return MathHelp.addQuantities(shipQuantities,
								 (type: number): number | undefined => { return getShipQuantity(planetData, type) },
								 (type: number, value: number): void => { setShipQuantity(planetData, type, value) });
}

export function addPlanetShip(planetData: CoreType.PlanetData, shipType: number, amountToAdd: number): number
{
	return MathHelp.addQuantity(shipType, amountToAdd,
							   (type: number): number | undefined => { return getShipQuantity(planetData, type) },
							   (type: number, value: number): void => { setShipQuantity(planetData, type, value) });
}
// #endregion