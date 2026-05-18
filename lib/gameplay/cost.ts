import * as Building from "@/lib/gameplay/coreData/buildingCostFormulas";
import * as PlanetData from "@/lib/playerData/buildingData";
import * as PlayerDataType from "@/lib/playerData/playerDataTypes";
import * as ResourceData from "@/lib/playerData/resourceData";

export function computeBuildingUpgradeCost(currentUpgradeLevel: number, buildingType: number): Map<number, number> | null
{
	const costFunction: ((currentUpgradeLevel: number) => Map<number, number>) | undefined = Building.buildingCostFunctionMap.get(buildingType);
	if (costFunction === undefined)
	{
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
        const currentResourceQuantity: number | undefined = ResourceData.getResourceQuantity(fullPlanetData, resourceType); 
		if (currentResourceQuantity === undefined)
		{
			return false;
		}

		if (currentResourceQuantity < resourceCost)
		{
			return false;
		}
    }

	return true;
}