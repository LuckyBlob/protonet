import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as StaticData from "@/lib/gameplay/coreData/static/staticData";
import * as StaticDataHelper from "@/lib/gameplay/coreData/static/staticDataHelpers";
import * as ResearchData from "@/lib/gameplay/dynamicData/player/researchData";
import * as UnitSpeed from "@/lib/gameplay/coreData/formula/unitSpeedFormulas";

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

export function computeFuelConsumption(playerData: CoreType.PlayerData, unitQuantities: Map<GameType.UnitType, number>, distance: number, speed: number, serverData: CoreType.ServerData | null): Map<GameType.ResourceType, number>
{
	return computeFuelConsumption_Base(playerData, unitQuantities, distance, speed, serverData);
}

type ResolvedUnitFuelData =
{
	unitQuantity: number;
	maxSpeed: number;
	baseFuelConsumption: Map<GameType.ResourceType, number>;
};

function computeFuelConsumption_Base(playerData: CoreType.PlayerData, unitQuantities: Map<GameType.UnitType, number>, distance: number, speed: number, serverData: CoreType.ServerData | null): Map<GameType.ResourceType, number>
{
	const resolvedUnitFuelDatas: ResolvedUnitFuelData[] = [];
	let fleetLowestMaxSpeed: number = Number.MAX_SAFE_INTEGER;

	for (const [unitType, unitQuantity] of unitQuantities)
	{
		if (unitQuantity === 0)
		{
			continue;
		}

		const unitStats: GameType.UnitStats = StaticDataHelper.getUnitStats(unitType);

		if (unitStats.baseFuelConsumption === undefined || unitStats.speed === undefined)
		{
			return new Map<GameType.ResourceType, number>();
		}

		const baseFuelConsumption: Map<GameType.ResourceType, number> | undefined = ResearchData.resolveEngineTechValue(playerData, unitStats.baseFuelConsumption);
		if (baseFuelConsumption === undefined)
		{
			throw new Error(`⚠️: Unit type ${unitType} has no engine-tech fuel tier matching the player's research.`);
		}

		const maxSpeed: number | undefined = UnitSpeed.computeUnitSpeed(playerData, unitStats.speed.engineTechData);
		if (maxSpeed === undefined)
		{
			throw new Error(`⚠️: Unit type ${unitType} has no engine-tech speed tier matching the player's research.`);
		}

		const resolvedUnitFuelData: ResolvedUnitFuelData =
		{
			unitQuantity: unitQuantity,
			maxSpeed: maxSpeed,
			baseFuelConsumption: baseFuelConsumption,
		};
		resolvedUnitFuelDatas.push(resolvedUnitFuelData);

		if (maxSpeed < fleetLowestMaxSpeed)
		{
			fleetLowestMaxSpeed = maxSpeed;
		}
	}

	const totalBaseCost: Map<GameType.ResourceType, number> = new Map<GameType.ResourceType, number>();
	for (const resolvedUnitFuelData of resolvedUnitFuelDatas)
	{
		// The whole fleet travels at its slowest unit's max speed, so a faster unit is throttled below
		// its own max and burns less fuel. Each unit's effective speed is the requested speed scaled by
		// (fleet speed / its own max speed): the slowest unit runs at the full requested speed, faster
		// units proportionally less (a 2× faster unit in the fleet effectively runs at half the speed).
		const effectiveSpeed: number = speed * fleetLowestMaxSpeed / resolvedUnitFuelData.maxSpeed;
		const speedFactor: number = Math.pow(effectiveSpeed / BASE_FUEL_CONSUMPTION_DATA.speedDivider + 1, BASE_FUEL_CONSUMPTION_DATA.exponent);

		for (const [ressourceType, baseFuelResourceCost] of resolvedUnitFuelData.baseFuelConsumption)
		{
			const additionalCost: number = baseFuelResourceCost * resolvedUnitFuelData.unitQuantity * (distance / BASE_FUEL_CONSUMPTION_DATA.costDistanceDivider) * speedFactor;
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