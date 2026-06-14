import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as StaticData from "@/lib/gameplay/coreData/static/staticData";
import * as StaticDataHelper from "@/lib/gameplay/coreData/static/staticDataHelpers";

type BaseFuelConsumptionData =
{
	costDistanceDivider: number;
	speedDivider: number;
	exponent: number;
};
const BASE_FUEL_CONSUMPTION_DATA: BaseFuelConsumptionData =
{
	costDistanceDivider: 35000,
	speedDivider: 100,
	exponent: 2,
};

export function computeFuelConsumption(shipQuantities: Map<GameType.ShipType, number>, distance: number, speed: number, serverData: CoreType.ServerData | null): Map<GameType.ResourceType, number>
{
	return computeFuelConsumption_Base(shipQuantities, distance, speed, serverData);
}

// Speed is 1-10, where 1 is 10% and 10 is 100% max speed.
function computeFuelConsumption_Base(shipQuantities: Map<GameType.ShipType, number>, distance: number, speed: number, serverData: CoreType.ServerData | null): Map<GameType.ResourceType, number>
{
	const totalBaseCost: Map<GameType.ResourceType, number> = new Map<GameType.ResourceType, number>();
	for (const [shipType, shipQuantity] of shipQuantities)
	{
		if (shipQuantity === 0)
    	{
        	continue;
    	}

		const shipStats: GameType.ShipStats | undefined = StaticDataHelper.getShipStats(shipType);
		if (shipStats === undefined)
		{
			throw new Error(`⚠️: Building type ${shipType} has no ship stats.`); 
		}

		for (const [ressourceType, baseFuelResourceCost] of shipStats.baseFuelConsumption)
		{
			const additionalCost: number = baseFuelResourceCost * shipQuantity;
			totalBaseCost.set(ressourceType, (totalBaseCost.get(ressourceType) ?? 0) + additionalCost);
		}
	}

	for (const [ressourceType, totalBaseResourceCost] of totalBaseCost)
	{
		const finalCost: number = 1 + Math.round((totalBaseResourceCost * distance / BASE_FUEL_CONSUMPTION_DATA.costDistanceDivider) * Math.pow(speed / BASE_FUEL_CONSUMPTION_DATA.speedDivider + 1, BASE_FUEL_CONSUMPTION_DATA.exponent));
		totalBaseCost.set(ressourceType, finalCost);
	}

	return totalBaseCost;
}