import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as StaticDataHelper from "@/lib/gameplay/coreData/static/staticDataHelpers";
import * as CombatResearch from "@/lib/gameplay/coreData/formula/combatResearchFunctions";
import * as UnitSpeed from "@/lib/gameplay/coreData/formula/unitSpeedFormulas";
import * as FleetRange from "@/lib/gameplay/coreData/formula/fleetRangeFormulas";
import * as DescriptionFormat from "@/lib/gameplay/coreData/description/descriptionFormat";

function getResearchPlayerValueFactor(researchType: GameType.ResearchType, playerValueType: GameType.PlayerValueType): number
{
	const researchInfo: GameType.ResearchInfo = StaticDataHelper.getResearchInfo(researchType);
	const playerValueStats: GameType.PlayerValueStat[] | undefined = researchInfo.playerValueStats;

	if (playerValueStats === undefined)
	{
		throw new Error(`Research ${researchType} has no player value stats to describe.`);
	}

	const matchingPlayerValueStat: GameType.PlayerValueStat | undefined = playerValueStats.find((playerValueStat: GameType.PlayerValueStat): boolean => playerValueStat.playerValueType === playerValueType);

	if (matchingPlayerValueStat === undefined)
	{
		throw new Error(`Research ${researchType} has no player value stat for player value type ${playerValueType}.`);
	}

	return matchingPlayerValueStat.basePlayerValueFactor;
}

function buildEnergyTechDescriptionLines(): string[]
{
	const descriptionLines: string[] =
	[
		"Powers your energy-hungry technologies and unlocks advanced research.",
		"Each level increases the energy output of your Fusion Reactor.",
	];

	return descriptionLines;
}

function buildCombustionDriveDescriptionLines(): string[]
{
	const speedBonusPerLevel: number = UnitSpeed.getEngineTechSpeedBonusPerLevel(GameType.ResearchType.CombustionDrive);
	const speedBonusPercentPerLevel: number = speedBonusPerLevel * 100;

	const descriptionLines: string[] =
	[
		"The basic propulsion system fitted to your earliest ships.",
		`Each level increases the speed of combustion-powered units by ${DescriptionFormat.formatNumber(speedBonusPercentPerLevel)}%.`,
	];

	return descriptionLines;
}

function buildImpulseDriveDescriptionLines(): string[]
{
	const speedBonusPerLevel: number = UnitSpeed.getEngineTechSpeedBonusPerLevel(GameType.ResearchType.ImpulseDrive);
	const speedBonusPercentPerLevel: number = speedBonusPerLevel * 100;
	const missileRangeSystemsPerLevel: number = FleetRange.MISSILE_RANGE_SYSTEMS_PER_IMPULSE_LEVEL;

	const descriptionLines: string[] =
	[
		"An advanced propulsion system used by mid-tier ships.",
		`Each level increases the speed of impulse-powered units by ${DescriptionFormat.formatNumber(speedBonusPercentPerLevel)}%.`,
		`Each level extends interplanetary missile range by ${DescriptionFormat.formatNumber(missileRangeSystemsPerLevel)} systems.`,
	];

	return descriptionLines;
}

function buildHyperspaceDriveDescriptionLines(): string[]
{
	const speedBonusPerLevel: number = UnitSpeed.getEngineTechSpeedBonusPerLevel(GameType.ResearchType.HyperspaceDrive);
	const speedBonusPercentPerLevel: number = speedBonusPerLevel * 100;

	const descriptionLines: string[] =
	[
		"The most advanced propulsion system, powering your largest ships.",
		`Each level increases the speed of hyperspace-powered units by ${DescriptionFormat.formatNumber(speedBonusPercentPerLevel)}%.`,
	];

	return descriptionLines;
}

function buildComputerTechDescriptionLines(): string[]
{
	const fleetSlotsPerLevel: number = getResearchPlayerValueFactor(GameType.ResearchType.ComputerTech, GameType.PlayerValueType.FleetSlots);

	const descriptionLines: string[] =
	[
		"Expands the command capacity of your empire.",
		`Each level grants +${DescriptionFormat.formatNumber(fleetSlotsPerLevel)} fleet slot.`,
	];

	return descriptionLines;
}

function buildEspionageTechDescriptionLines(): string[]
{
	const descriptionLines: string[] =
	[
		"Develops your intelligence-gathering and counter-intelligence.",
		"Higher levels reveal more detail in your espionage reports and improve your chance to detect enemy probes.",
	];

	return descriptionLines;
}

function buildWeaponTechDescriptionLines(): string[]
{
	const weaponBonusPercentPerLevel: number = CombatResearch.COMBAT_RESEARCH_BONUS_PER_LEVEL * 100;

	const descriptionLines: string[] =
	[
		"Improves the firepower of all your combat units.",
		`Each level increases weapon power by ${DescriptionFormat.formatNumber(weaponBonusPercentPerLevel)}%.`,
	];

	return descriptionLines;
}

function buildShieldingTechDescriptionLines(): string[]
{
	const shieldBonusPercentPerLevel: number = CombatResearch.COMBAT_RESEARCH_BONUS_PER_LEVEL * 100;

	const descriptionLines: string[] =
	[
		"Strengthens the shielding of all your combat units.",
		`Each level increases shield power by ${DescriptionFormat.formatNumber(shieldBonusPercentPerLevel)}%.`,
	];

	return descriptionLines;
}

function buildArmourTechDescriptionLines(): string[]
{
	const armourBonusPercentPerLevel: number = CombatResearch.COMBAT_RESEARCH_BONUS_PER_LEVEL * 100;

	const descriptionLines: string[] =
	[
		"Reinforces the hull plating of all your combat units.",
		`Each level increases armour by ${DescriptionFormat.formatNumber(armourBonusPercentPerLevel)}%.`,
	];

	return descriptionLines;
}

function buildAstrophysicsDescriptionLines(): string[]
{
	const colonySlotsFactor: number = getResearchPlayerValueFactor(GameType.ResearchType.Astrophysics, GameType.PlayerValueType.ColonySlots);
	const levelsPerColonySlot: number = 1 / colonySlotsFactor;

	const descriptionLines: string[] =
	[
		"Enables the colonisation of additional planets.",
		`Every ${DescriptionFormat.formatNumber(levelsPerColonySlot)} levels grants +1 colony slot.`,
	];

	return descriptionLines;
}

function buildIntergalacticResearchNetworkDescriptionLines(): string[]
{
	const descriptionLines: string[] =
	[
		"Links the Research Labs across your planets so they share research power.",
		"Each level connects one more of your planets' Research Labs, adding its level to your research speed.",
	];

	return descriptionLines;
}

function buildGravitonTechDescriptionLines(): string[]
{
	const descriptionLines: string[] =
	[
		"Unlocks Graviton-tier construction, including the Death Star.",
		"Researched instantly, but demands an enormous amount of energy production to begin.",
	];

	return descriptionLines;
}

function buildLaserTechDescriptionLines(): string[]
{
	const descriptionLines: string[] =
	[
		"Foundational weapons research.",
		"Unlocks more advanced technologies rather than providing a direct combat bonus.",
	];

	return descriptionLines;
}

function buildIonTechDescriptionLines(): string[]
{
	const deconstructionCostFactor: number = getResearchPlayerValueFactor(GameType.ResearchType.IonTech, GameType.PlayerValueType.DeconstructionCostModificationPercent);
	const deconstructionCostReductionPercentPerLevel: number = Math.abs(deconstructionCostFactor);

	const descriptionLines: string[] =
	[
		"Refines deconstruction techniques so you recover more when dismantling buildings.",
		`Each level reduces building deconstruction cost by ${DescriptionFormat.formatNumber(deconstructionCostReductionPercentPerLevel)}%.`,
	];

	return descriptionLines;
}

function buildPlasmaTechDescriptionLines(): string[]
{
	const metalProductionPercentPerLevel: number = getResearchPlayerValueFactor(GameType.ResearchType.PlasmaTech, GameType.PlayerValueType.MetalProductionModificationPercent);
	const crystalProductionPercentPerLevel: number = getResearchPlayerValueFactor(GameType.ResearchType.PlasmaTech, GameType.PlayerValueType.CrystalProductionModificationPercent);
	const deuteriumProductionPercentPerLevel: number = getResearchPlayerValueFactor(GameType.ResearchType.PlasmaTech, GameType.PlayerValueType.DeuteriumProductionModificationPercent);

	const descriptionLines: string[] =
	[
		"Boosts the output of your resource mines.",
		`Each level increases metal production by ${DescriptionFormat.formatNumber(metalProductionPercentPerLevel)}%, crystal by ${DescriptionFormat.formatNumber(crystalProductionPercentPerLevel)}%, and deuterium by ${DescriptionFormat.formatNumber(deuteriumProductionPercentPerLevel)}%.`,
	];

	return descriptionLines;
}

function buildHyperspaceTechDescriptionLines(): string[]
{
	const fleetSpacePercentPerLevel: number = getResearchPlayerValueFactor(GameType.ResearchType.HyperspaceTech, GameType.PlayerValueType.FleetSpaceModificationPercent);

	const descriptionLines: string[] =
	[
		"Expands the cargo capacity of your entire fleet.",
		`Each level increases fleet cargo space by ${DescriptionFormat.formatNumber(fleetSpacePercentPerLevel)}%.`,
	];

	return descriptionLines;
}

const RESEARCH_DESCRIPTION_LINE_BUILDERS: ReadonlyMap<GameType.ResearchType, () => string[]> = new Map<GameType.ResearchType, () => string[]>
([
	[GameType.ResearchType.EnergyTech, buildEnergyTechDescriptionLines],
	[GameType.ResearchType.CombustionDrive, buildCombustionDriveDescriptionLines],
	[GameType.ResearchType.ImpulseDrive, buildImpulseDriveDescriptionLines],
	[GameType.ResearchType.HyperspaceDrive, buildHyperspaceDriveDescriptionLines],
	[GameType.ResearchType.ComputerTech, buildComputerTechDescriptionLines],
	[GameType.ResearchType.EspionageTech, buildEspionageTechDescriptionLines],
	[GameType.ResearchType.WeaponTech, buildWeaponTechDescriptionLines],
	[GameType.ResearchType.ShieldingTech, buildShieldingTechDescriptionLines],
	[GameType.ResearchType.ArmourTech, buildArmourTechDescriptionLines],
	[GameType.ResearchType.Astrophysics, buildAstrophysicsDescriptionLines],
	[GameType.ResearchType.IntergalacticResearchNetwork, buildIntergalacticResearchNetworkDescriptionLines],
	[GameType.ResearchType.GravitonTech, buildGravitonTechDescriptionLines],
	[GameType.ResearchType.LaserTech, buildLaserTechDescriptionLines],
	[GameType.ResearchType.IonTech, buildIonTechDescriptionLines],
	[GameType.ResearchType.PlasmaTech, buildPlasmaTechDescriptionLines],
	[GameType.ResearchType.HyperspaceTech, buildHyperspaceTechDescriptionLines],
]);

export function getResearchDescriptionLines(researchType: GameType.ResearchType): string[]
{
	const descriptionLineBuilder: (() => string[]) | undefined = RESEARCH_DESCRIPTION_LINE_BUILDERS.get(researchType);

	if (descriptionLineBuilder === undefined)
	{
		throw new Error(`No research description for research type ${researchType}.`);
	}

	return descriptionLineBuilder();
}
