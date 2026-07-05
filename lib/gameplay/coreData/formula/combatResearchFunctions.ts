import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as ResearchData from "@/lib/gameplay/dynamicData/player/researchData";

export const COMBAT_RESEARCH_BONUS_PER_LEVEL: number = 0.10;

function computeCombatStatWithResearch(playerData: CoreType.PlayerData, baseValue: number, researchType: GameType.ResearchType): number
{
	const researchLevel: number = ResearchData.getResearchLevel(playerData, researchType);
	return baseValue * (1 + COMBAT_RESEARCH_BONUS_PER_LEVEL * researchLevel);
}

export function computeUnitWeaponPower(playerData: CoreType.PlayerData, unitStats: GameType.UnitStats): number
{
	return computeCombatStatWithResearch(playerData, unitStats.weaponPower, GameType.ResearchType.WeaponTech);
}

export function computeUnitShieldPower(playerData: CoreType.PlayerData, unitStats: GameType.UnitStats): number
{
	return computeCombatStatWithResearch(playerData, unitStats.shieldPower, GameType.ResearchType.ShieldingTech);
}

export function computeUnitArmour(playerData: CoreType.PlayerData, unitStats: GameType.UnitStats): number
{
	return computeCombatStatWithResearch(playerData, unitStats.maxHealth, GameType.ResearchType.ArmourTech);
}
