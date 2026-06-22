import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as StaticData from "@/lib/gameplay/coreData/static/staticData";
import * as StaticDataHelper from "@/lib/gameplay/coreData/static/staticDataHelpers";
import * as ResearchData from "@/lib/gameplay/dynamicData/player/researchData";
import * as ShipSpeed from "@/lib/gameplay/coreData/formula/shipSpeedFormulas";

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

export function computeFuelConsumption(playerData: CoreType.PlayerData, shipQuantities: Map<GameType.ShipType, number>, distance: number, speed: number, serverData: CoreType.ServerData | null): Map<GameType.ResourceType, number>
{
	return computeFuelConsumption_Base(playerData, shipQuantities, distance, speed, serverData);
}

type ResolvedShipFuelData =
{
	shipQuantity: number;
	maxSpeed: number;
	baseFuelConsumption: Map<GameType.ResourceType, number>;
};

// Speed percentage of max speed
function computeFuelConsumption_Base(playerData: CoreType.PlayerData, shipQuantities: Map<GameType.ShipType, number>, distance: number, speed: number, serverData: CoreType.ServerData | null): Map<GameType.ResourceType, number>
{
	const resolvedShipFuelDatas: ResolvedShipFuelData[] = [];
	let fleetLowestMaxSpeed: number = Number.MAX_SAFE_INTEGER;

	for (const [shipType, shipQuantity] of shipQuantities)
	{
		if (shipQuantity === 0)
		{
			continue;
		}

		const shipStats: GameType.ShipStats = StaticDataHelper.getShipStats(shipType);

		if (shipStats.baseFuelConsumption === undefined)
		{
			return new Map<GameType.ResourceType, number>();
		}

		const baseFuelConsumption: Map<GameType.ResourceType, number> | undefined = ResearchData.resolveEngineTechValue(playerData, shipStats.baseFuelConsumption);
		if (baseFuelConsumption === undefined)
		{
			throw new Error(`⚠️: Ship type ${shipType} has no engine-tech fuel tier matching the player's research.`);
		}

		const maxSpeed: number | undefined = ShipSpeed.computeShipSpeed(playerData, shipStats.speed);
		if (maxSpeed === undefined)
		{
			throw new Error(`⚠️: Ship type ${shipType} has no engine-tech speed tier matching the player's research.`);
		}

		const resolvedShipFuelData: ResolvedShipFuelData =
		{
			shipQuantity: shipQuantity,
			maxSpeed: maxSpeed,
			baseFuelConsumption: baseFuelConsumption,
		};
		resolvedShipFuelDatas.push(resolvedShipFuelData);

		if (maxSpeed < fleetLowestMaxSpeed)
		{
			fleetLowestMaxSpeed = maxSpeed;
		}
	}

	const totalBaseCost: Map<GameType.ResourceType, number> = new Map<GameType.ResourceType, number>();
	for (const resolvedShipFuelData of resolvedShipFuelDatas)
	{
		// The whole fleet travels at its slowest ship's max speed, so a faster ship is throttled below
		// its own max and burns less fuel. Each ship's effective speed is the requested speed scaled by
		// (fleet speed / its own max speed): the slowest ship runs at the full requested speed, faster
		// ships proportionally less (a 2× faster ship in the fleet effectively runs at half the speed).
		const effectiveSpeed: number = speed * fleetLowestMaxSpeed / resolvedShipFuelData.maxSpeed;
		const speedFactor: number = Math.pow(effectiveSpeed / BASE_FUEL_CONSUMPTION_DATA.speedDivider + 1, BASE_FUEL_CONSUMPTION_DATA.exponent);

		for (const [ressourceType, baseFuelResourceCost] of resolvedShipFuelData.baseFuelConsumption)
		{
			const additionalCost: number = baseFuelResourceCost * resolvedShipFuelData.shipQuantity * (distance / BASE_FUEL_CONSUMPTION_DATA.costDistanceDivider) * speedFactor;
			totalBaseCost.set(ressourceType, (totalBaseCost.get(ressourceType) ?? 0) + additionalCost);
		}
	}

	for (const [ressourceType, totalBaseResourceCost] of totalBaseCost)
	{
		const finalCost: number = 1 + Math.round(totalBaseResourceCost);
		totalBaseCost.set(ressourceType, finalCost);
	}

	return totalBaseCost;
}