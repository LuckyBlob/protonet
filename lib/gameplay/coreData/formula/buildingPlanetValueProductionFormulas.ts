import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as StaticData from "@/lib/gameplay/coreData/static/staticData";
import * as StaticDataHelper from "@/lib/gameplay/coreData/static/staticDataHelpers";

export function computeBuildingPlanetValueProduction(currentUpgradeLevel: number, buildingType: GameType.BuildingType): Map<GameType.PlanetValueType, CoreType.PlanetValueData> | null
{
    const buildingStats: GameType.BuildingStats | undefined = StaticDataHelper.getBuildingStats(buildingType);
    if (buildingStats === undefined)
    {
        console.error("⚠️:", `Building type ${buildingType} has no Planet Value Production.`); 
        return null;
    }

    switch (buildingStats.planetValueProductionFormulasType)
    {
        case GameType.BuildingPlanetValueProductionFormulasType.SimpleExponential:
        {
            return computeBuildingPlanetValueProductionInternal(currentUpgradeLevel, buildingStats, computeBuildingPlanetValueProduction_SimpleExponential);
        }
        case GameType.BuildingPlanetValueProductionFormulasType.FlooredNaturalExponential:
        {
            return computeBuildingPlanetValueProductionInternal(currentUpgradeLevel, buildingStats, computeBuildingPlanetValueProduction_FlooredNaturalExponential);
        }
        default:
            return null;
    }
}

function computeBuildingPlanetValueProduction_SimpleExponential(currentUpgradeLevel: number, buildingStats: GameType.BuildingStats, planetValueFactor: number): number
{
    if (buildingStats.planetValueStats!.basePlanetValueExponent === undefined)
    {
        throw new Error(`Must have basePlanetValueExponent for computeBuildingPlanetValueProduction_SimpleExponential.`);
    }

    return planetValueFactor * currentUpgradeLevel * Math.pow(buildingStats.planetValueStats!.basePlanetValueExponent, currentUpgradeLevel);
}

function computeBuildingPlanetValueProduction_FlooredNaturalExponential(currentUpgradeLevel: number, buildingStats: GameType.BuildingStats, planetValueFactor: number): number
{
    if (buildingStats.planetValueStats!.naturalExponentialFactor === undefined || buildingStats.planetValueStats!.naturalExponentialExponentFactor === undefined)
    {
        throw new Error(`Must have naturalExponentialFactor and naturalExponentialExponentFactor for computeBuildingPlanetValueProduction_FlooredNaturalExponential.`);
    }

    return planetValueFactor * Math.floor(buildingStats.planetValueStats!.naturalExponentialFactor * Math.exp(buildingStats.planetValueStats!.naturalExponentialExponentFactor * currentUpgradeLevel));
}

function computeBuildingPlanetValueProductionInternal(
    currentUpgradeLevel: number, 
    buildingStats: GameType.BuildingStats, 
    applyFunction: (currentUpgradeLevel: number, buildingStats: GameType.BuildingStats, planetValueFactor: number) => number): Map<GameType.PlanetValueType, CoreType.PlanetValueData> | null
{
    if (buildingStats.planetValueStats === undefined)
	{
		return null;
	}

    const planetValueMap: Map<GameType.PlanetValueType, CoreType.PlanetValueData> = new Map<GameType.PlanetValueType, CoreType.PlanetValueData>();
    for (const [planetValueType, planetValueFactor] of buildingStats.planetValueStats.basePlanetValueFactor)
    {
        // Each applyFunction validates its own required stats (SimpleExponential needs basePlanetValueExponent,
        // FlooredNaturalExponential needs naturalExponential*), so this shared loop must not assume either.
        const newPlanetValue: number = applyFunction(currentUpgradeLevel, buildingStats, planetValueFactor);
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
