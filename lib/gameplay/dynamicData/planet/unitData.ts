import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as ThingHelpers from "@/lib/gameplay/coreData/thing/thingHelpers";
import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as MathHelp from "@/lib/helper/mathHelp";
import * as StaticDataHelper from "@/lib/gameplay/coreData/static/staticDataHelpers";

// #region Unit Management
export function setUnitQuantity(planetData: CoreType.PlanetData, unitType: GameType.UnitType, value: number): void
{
	ThingHelpers.setSpecificThingValue(null, planetData, CoreType.DataContext.UnitQuantity, unitType, value);
}

export function getUnitQuantity(planetData: CoreType.PlanetData, unitType: GameType.UnitType): number
{
	const unitQuantities: Map<GameType.UnitType, number> = ThingHelpers.getThingValues(null, planetData, CoreType.DataContext.UnitQuantity) as Map<GameType.UnitType, number>;
	return unitQuantities.get(unitType) ?? 0;
}

export function getCategoryUnitQuantity(planetData: CoreType.PlanetData, unitCategory: GameType.UnitCategory): number
{
	const categoryUnitTypes: GameType.UnitType[] = StaticDataHelper.getUnitsByCategory(unitCategory);
	let totalCategoryUnitQuantity: number = 0;
	for (const unitType of categoryUnitTypes)
	{
		totalCategoryUnitQuantity += getUnitQuantity(planetData, unitType);
	}

	return totalCategoryUnitQuantity;
}

export function hasUnitQuantities(planetData: CoreType.PlanetData, unitQuantities: Map<GameType.UnitType, number>): boolean
{
	return MathHelp.hasQuantities(unitQuantities, (type: GameType.UnitType): number | undefined => { return getUnitQuantity(planetData, type) });
}

export function hasUnits(planetData: CoreType.PlanetData): boolean
{
	const unitQuantities: Map<GameType.UnitType, number> = ThingHelpers.getThingValues(null, planetData, CoreType.DataContext.UnitQuantity) as Map<GameType.UnitType, number>;
	for (const [unitType, unitQuantity] of unitQuantities)
	{
		if (unitQuantity > 0)
		{
			return true;
		}
	}

	return false;
}

export function subtractPlanetUnits(planetData: CoreType.PlanetData, unitQuantities: Map<GameType.UnitType, number>): Map<GameType.UnitType, number>
{
	return MathHelp.subtractQuantities(unitQuantities,
									  (type: GameType.UnitType): number | undefined => { return getUnitQuantity(planetData, type) },
									  (type: GameType.UnitType, value: number): void => { setUnitQuantity(planetData, type, value) });
}

export function subtractPlanetUnit(planetData: CoreType.PlanetData, unitType: GameType.UnitType, amountToSubtract: number): number
{
	return MathHelp.subtractQuantity(unitType, amountToSubtract,
									(type: GameType.UnitType): number | undefined => { return getUnitQuantity(planetData, type) },
									(type: GameType.UnitType, value: number): void => { setUnitQuantity(planetData, type, value) });
}

export function addPlanetUnits(planetData: CoreType.PlanetData, unitQuantities: Map<GameType.UnitType, number>): Map<GameType.UnitType, number>
{
	return MathHelp.addQuantities(unitQuantities,
								 (type: GameType.UnitType): number | undefined => { return getUnitQuantity(planetData, type) },
								 (type: GameType.UnitType, value: number): void => { setUnitQuantity(planetData, type, value) });
}

export function addPlanetUnit(planetData: CoreType.PlanetData, unitType: GameType.UnitType, amountToAdd: number): number
{
	return MathHelp.addQuantity(unitType, amountToAdd,
							   (type: GameType.UnitType): number | undefined => { return getUnitQuantity(planetData, type) },
							   (type: GameType.UnitType, value: number): void => { setUnitQuantity(planetData, type, value) });
}
// #endregion
