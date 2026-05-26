import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as ServerDataType from "@/lib/gameplay/gameplayData/server/serverDataTypes";
import * as AssociationMaps from "@/lib/gameplay/coreData/associationMaps";

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

export function computeFuelConsumption(shipQuantities: Map<number, number>, distance: number, speed: number, serverData: ServerDataType.ServerData | null): Map<number, number>
{
	return computeFuelConsumption_Base(shipQuantities, distance, speed, serverData);
}

// Speed is 1-10, where 1 is 10% and 10 is 100% max speed.
function computeFuelConsumption_Base(shipQuantities: Map<number, number>, distance: number, speed: number, serverData: ServerDataType.ServerData | null): Map<number, number>
{
	const totalBaseCost: Map<number, number> = new Map<number, number>();
	for (const [shipType, shipQuantity] of shipQuantities)
	{
		if (shipQuantity === 0)
    	{
        	continue;
    	}

		const shipStats: AssociationMaps.ShipStats | undefined = AssociationMaps.SHIP_STATS.get(shipType);
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