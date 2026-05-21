import * as Building from "@/lib/gameplay/coreData/formula/buildingCostFormulas";
import * as PlanetData from "@/lib/gameplay/gameplayData/dynamic/buildingData";
import * as PlayerDataType from "@/lib/gameplay/gameplayData/player/playerDataTypes";
import * as ResourceData from "@/lib/gameplay/gameplayData/dynamic/resourceData";

export function computeBuildingUpgradeCost(currentUpgradeLevel: number, buildingType: number): Map<number, number> | null
{
	const costFunction: ((currentUpgradeLevel: number) => Map<number, number>) | undefined = Building.buildingCostFunctionMap.get(buildingType);
	if (costFunction === undefined)
	{
		console.warn("⚠️:", `Building type ${buildingType} has no calculatable cost.`); 
		return null;
	}

	return costFunction(currentUpgradeLevel);
}

export function canAffordUpgrade(fullPlanetData: PlayerDataType.FullPlanetData, buildingType: number): boolean
{
	const currentUpgradeLevel: number = PlanetData.getBuildingLevel(fullPlanetData, buildingType);
	const nextUpgradeCostMap: Map<number, number> | null = computeBuildingUpgradeCost(currentUpgradeLevel, buildingType);
	if (nextUpgradeCostMap === null)
	{
	    return false;
	}

	for (const [resourceType, resourceCost] of nextUpgradeCostMap)
	{
        const currentResourceQuantity: number = ResourceData.getResourceQuantity(fullPlanetData, resourceType); 
		if (currentResourceQuantity < resourceCost)
		{
			return false;
		}
    }

	return true;
}