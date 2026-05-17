import * as DBType from "@/lib/db/dbTypes";
import * as AssociationMaps from "@/lib/gameplay/coreData/associationMaps";

import * as Building from "@/lib/gameplay/coreData/buildingCostFormulas";
import * as PlanetData from "@/lib/playerData/planetData";

export function computeUpgradeCost(currentUpgradeLevel: number, buildingType: number): Map<number, number> | null
{
	const costFunction: ((currentUpgradeLevel: number) => Map<number, number>) | undefined = Building.buildingCostFunctionMap.get(buildingType);
	if (costFunction === undefined)
	{
		return null;
	}

	return costFunction(currentUpgradeLevel);
}

export function canAffordUpgrade(fullPlanetData: PlanetData.FullPlanetData, buildingType: number): boolean
{
	const currentUpgradeLevel: number | null = PlanetData.getBuildingLevel(fullPlanetData, buildingType);
	if (currentUpgradeLevel === null)
	{
	    return false;
	}
	
	const nextUpgradeCostMap: Map<number, number> | null = computeUpgradeCost(currentUpgradeLevel, buildingType);
	if (nextUpgradeCostMap === null)
	{
	    return false;
	}

	const ressourceQuantityMap: Map<number, number> = PlanetData.getRessourceQuantityMap(fullPlanetData);

	for (const [ressourceType, ressourceCost] of nextUpgradeCostMap)
	{
        const currentRessourceQuantity: number | undefined = ressourceQuantityMap.get(ressourceType); 
		if (currentRessourceQuantity === undefined)
		{
			return false;
		}

		if (currentRessourceQuantity < ressourceCost)
		{
			return false;
		}
    }

	return true;
}