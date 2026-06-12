import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";

export function computeBuildingPlanetValueProduction(currentUpgradeLevel: number, buildingType: number): Map<number, CoreType.PlanetValueData> | null
{
    const buildingStats: GameType.BuildingStats | undefined = GameType.BUILDING_STATS.get(buildingType);
    if (buildingStats === undefined)
    {
        console.error("⚠️:", `Building type ${buildingType} has no Planet Value Production.`); 
        return null;
    }

    switch (buildingStats.planetValueProductionFormulasType)
    {
        case GameType.BuildingPlanetValueProductionFormulasType.SimpleExponential:
        {
            return computeBuildingPlanetValueProduction_SimpleExponential(currentUpgradeLevel, buildingStats);
        }
        default:
            return null;
    }
}
function computeBuildingPlanetValueProduction_SimpleExponential(currentUpgradeLevel: number, buildingStats: GameType.BuildingStats): Map<number, CoreType.PlanetValueData> | null
{
    if (buildingStats.planetValueStats === undefined)
	{
		return null;
	}

    const planetValueMap: Map<number, CoreType.PlanetValueData> = new Map<number, CoreType.PlanetValueData>();
    for (const [planetValueType, planetValueFactor] of buildingStats.planetValueStats.basePlanetValueFactor)
    {
        const newPlanetValue: number = planetValueFactor * currentUpgradeLevel * Math.pow(buildingStats.planetValueStats.basePlanetValueExponent, currentUpgradeLevel);
        const newPlanetValueAmounts: CoreType.PlanetValueData =
        {
            production: 0,
            consumption: 0,
        }
        if (newPlanetValue <= 0)
        {
            newPlanetValueAmounts.consumption = Math.abs(newPlanetValue);
        }
        else
        {
            newPlanetValueAmounts.production = Math.abs(newPlanetValue);
        }
        planetValueMap.set(planetValueType, newPlanetValueAmounts);
    }

    return planetValueMap;
}
