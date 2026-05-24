import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as ServerDataType from "@/lib/gameplay/gameplayData/server/serverDataTypes";
import * as AssociationMaps from "@/lib/gameplay/coreData/associationMaps";

const DISTANCE_DIVIDER: number = 35000;
const SPEED_DIVIDER: number = 100;

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

function computeFuelConsumption_Base(shipQuantities: Map<number, number>, distance: number, speed: number, serverData: ServerDataType.ServerData | null): Map<number, number>
{
	let totalBaseCost: Map<number, number> = new Map<number, number>();
	for (const [shipType, shipQuantity] of shipQuantities)
	{
		const shipStats: AssociationMaps.ShipStats | undefined = AssociationMaps.SHIP_STATS.get(shipType);
		if (shipStats === undefined)
		{
			throw new Error(`⚠️: Building type ${shipType} has no ship stats.`); 
		}

		for (const [ressourceType, baseFuelResourceCost] of shipStats.baseFuelConsumption)
		{
			totalBaseCost.set(ressourceType, (totalBaseCost.get(ressourceType) ?? 0) + baseFuelResourceCost);
		}
	}

	for (const [ressourceType, totalBaseResourceCost] of totalBaseCost)
	{
		const finalCost: number = 1 + Math.round((totalBaseResourceCost * distance / DISTANCE_DIVIDER) * Math.pow(speed / SPEED_DIVIDER + 1, 2));
		totalBaseCost.set(ressourceType, finalCost);
	}

	return totalBaseCost;
}