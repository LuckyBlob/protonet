import * as Cost from "@/lib/gameplay/cost";

import * as ServerDataTypes from "@/lib/serverData/serverDataTypes";

export function computeUpgradeBuildDurationSeconds(currentUpgradeLevel: number, buildingType: number, serverData: ServerDataTypes.ServerData): number | null
{
	const cost: number | null = Cost.computeUpgradeCost(currentUpgradeLevel, buildingType);
	if (cost === null)
	{
	    return null;
	}

	const durationHours: number = cost / 2500;
	return Math.floor(durationHours * 3600 / serverData.config.time_multiplier);
}

