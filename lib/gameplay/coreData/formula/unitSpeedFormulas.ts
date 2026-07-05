import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as ResearchData from "@/lib/gameplay/dynamicData/player/researchData";

// Each level of the engine tech a unit currently runs on raises its speed by this fraction. The bonus
// only ever applies to the unit's active engine: a Small Transport on its Combustion tier gains
// 10%/level of Combustion Drive, but once Impulse Drive unlocks its Impulse tier it instead gains
// 20%/level of Impulse Drive (and the Combustion level stops mattering for it).
const ENGINE_TECH_SPEED_BONUS_PER_LEVEL: ReadonlyMap<GameType.EngineTech, number> = new Map<GameType.EngineTech, number>
([
	[GameType.ResearchType.CombustionDrive, 0.10],
	[GameType.ResearchType.ImpulseDrive, 0.20],
	[GameType.ResearchType.HyperspaceDrive, 0.30],
]);

export function getEngineTechSpeedBonusPerLevel(engineTech: GameType.EngineTech): number
{
	const speedBonusPerLevel: number | undefined = ENGINE_TECH_SPEED_BONUS_PER_LEVEL.get(engineTech);
	if (speedBonusPerLevel === undefined)
	{
		throw new Error(`⚠️: Engine tech ${engineTech} has no speed bonus per level.`);
	}

	return speedBonusPerLevel;
}

export function computeUnitSpeed(playerData: CoreType.PlayerData, unitSpeedDatas: GameType.EngineTechData<number>[] | undefined): number | undefined
{
	if (unitSpeedDatas === undefined)
	{
		return undefined;
	}

	const resolvedEngineTechData: GameType.EngineTechData<number> | undefined = ResearchData.resolveEngineTechData(playerData, unitSpeedDatas);
	if (resolvedEngineTechData === undefined)
	{
		return undefined;
	}

	const speedBonusPerLevel: number = getEngineTechSpeedBonusPerLevel(resolvedEngineTechData.engineTech);
	const engineResearchLevel: number = ResearchData.getResearchLevel(playerData, resolvedEngineTechData.engineTech);
	const baseSpeed: number = resolvedEngineTechData.value;
	return baseSpeed * (1 + speedBonusPerLevel * engineResearchLevel);
}
