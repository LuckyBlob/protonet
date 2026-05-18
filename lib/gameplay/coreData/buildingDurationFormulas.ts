import * as GameType from "@/lib/gameplay/gameTypes";
import * as ServerDataType from "@/lib/serverData/serverDataTypes";
import * as Cost from "@/lib/gameplay/cost";

export const buildingUpgradeDurationSecondsFunctionMap: Map<number, (currentUpgradeLevel: number, buildingType: number, serverData: ServerDataType.ServerData | null) => number> = new Map
([
	[GameType.BUILDING_1, (currentUpgradeLevel: number, buildingType: number, serverData: ServerDataType.ServerData | null): number => computeUpgradeDurationSeconds_SimpleBuilding(currentUpgradeLevel, BUILDING_GENERIC_DATA, buildingType, serverData)],
	[GameType.BUILDING_2, (currentUpgradeLevel: number, buildingType: number, serverData: ServerDataType.ServerData | null): number => computeUpgradeDurationSeconds_SimpleBuilding(currentUpgradeLevel, BUILDING_GENERIC_DATA, buildingType, serverData)],
	[GameType.BUILDING_3, (currentUpgradeLevel: number, buildingType: number, serverData: ServerDataType.ServerData | null): number => computeUpgradeDurationSeconds_SimpleBuilding(currentUpgradeLevel, BUILDING_GENERIC_DATA, buildingType, serverData)],
]);

type SimpleBuildingUpgradeDurationData =
{
	divider: number;
};

const BUILDING_GENERIC_DATA: SimpleBuildingUpgradeDurationData =
{
	divider: 2500,
};

function computeUpgradeDurationSeconds_SimpleBuilding(currentUpgradeLevel: number, data: SimpleBuildingUpgradeDurationData, buildingType: number, serverData: ServerDataType.ServerData | null): number
{
	const timeMultiplier: number = serverData ? serverData.config.time_multiplier : 1;
    const nextUpgradeCostMap: Map<number, number> | null = Cost.computeBuildingUpgradeCost(currentUpgradeLevel, buildingType);
    if (nextUpgradeCostMap === null)
    {
        return 0;
    }

    let totalCost: number = 0;
    for (const cost of nextUpgradeCostMap.values())
    {
        totalCost = totalCost + cost;
    }
    
	const durationSeconds: number = totalCost / data.divider * 3600;

	return Math.floor(durationSeconds / timeMultiplier);
}