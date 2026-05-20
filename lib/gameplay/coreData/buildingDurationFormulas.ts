import * as GameType from "@/lib/gameplay/gameTypes";
import * as ServerDataType from "@/lib/serverData/serverDataTypes";
import * as Cost from "@/lib/gameplay/cost";
import * as PlayerDataType from "@/lib/playerData/playerDataTypes";
import * as BuildingData from "@/lib/playerData/thingData/buildingData";
import * as PlayerData from "@/lib/playerData/thingData/playerData";

export const buildingUpgradeDurationSecondsFunctionMap: Map<number, (currentUpgradeLevel: number, buildingType: number, playerData: PlayerDataType.PlayerData, planetId: number, serverData: ServerDataType.ServerData | null) => number> = new Map
([
	[GameType.BUILDING_1, (currentUpgradeLevel: number, buildingType: number, playerData: PlayerDataType.PlayerData, planetId: number, serverData: ServerDataType.ServerData | null): number => computeUpgradeDurationSeconds_SimpleBuilding(currentUpgradeLevel, BUILDING_GENERIC_DATA, buildingType, playerData, planetId, serverData)],
	[GameType.BUILDING_2, (currentUpgradeLevel: number, buildingType: number, playerData: PlayerDataType.PlayerData, planetId: number, serverData: ServerDataType.ServerData | null): number => computeUpgradeDurationSeconds_SimpleBuilding(currentUpgradeLevel, BUILDING_GENERIC_DATA, buildingType, playerData, planetId, serverData)],
	[GameType.SHIPYARD_BUILDING_TYPE, (currentUpgradeLevel: number, buildingType: number, playerData: PlayerDataType.PlayerData, planetId: number, serverData: ServerDataType.ServerData | null): number => computeUpgradeDurationSeconds_SimpleBuilding(currentUpgradeLevel, BUILDING_GENERIC_DATA, buildingType, playerData, planetId, serverData)],
	[GameType.ROBOTIC_FACTORY_TYPE, (currentUpgradeLevel: number, buildingType: number, playerData: PlayerDataType.PlayerData, planetId: number, serverData: ServerDataType.ServerData | null): number => computeUpgradeDurationSeconds_SimpleBuilding(currentUpgradeLevel, BUILDING_GENERIC_DATA, buildingType, playerData, planetId, serverData)],
]);

type SimpleBuildingUpgradeDurationData =
{
	divider: number;
};

const BUILDING_GENERIC_DATA: SimpleBuildingUpgradeDurationData =
{
	divider: 2500,
};

function computeUpgradeDurationSeconds_SimpleBuilding(currentUpgradeLevel: number, data: SimpleBuildingUpgradeDurationData, buildingType: number, playerData: PlayerDataType.PlayerData, planetId: number, serverData: ServerDataType.ServerData | null): number
{
	const timeMultiplier: number = serverData ? serverData.config.time_multiplier : 1;
    const nextUpgradeCostMap: Map<number, number> | null = Cost.computeBuildingUpgradeCost(currentUpgradeLevel, buildingType);
    if (nextUpgradeCostMap === null)
    {
        throw new Error(`Building type ${buildingType} has no cost and thus no construction duration.`);
    }

    let totalCost: number = 0;
    for (const cost of nextUpgradeCostMap.values())
    {
        // Each ressources counts for 1 independantly of type
        totalCost = totalCost + cost;
    }
    
    const fullPlanetData: PlayerDataType.FullPlanetData | null = PlayerData.getFullPlanetDataForId(playerData.fullPlanetDatas, planetId);
    const roboticFactoryLevl: number = fullPlanetData === null ? 0 : BuildingData.getBuildingLevel(fullPlanetData, GameType.ROBOTIC_FACTORY_TYPE);

    const durationHours: number = totalCost / (data.divider * (1 + roboticFactoryLevl));
	const durationSeconds: number = durationHours * 3600;

	return Math.floor(durationSeconds / timeMultiplier);
}