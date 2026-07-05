import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as StaticDataHelper from "@/lib/gameplay/coreData/static/staticDataHelpers";
import * as DescriptionFormat from "@/lib/gameplay/coreData/description/descriptionFormat";

function buildUnitStatsLine(unitStats: GameType.UnitStats): string
{
	const statParts: string[] =
	[
		`Hull ${DescriptionFormat.formatNumber(unitStats.maxHealth)}`,
		`Shield ${DescriptionFormat.formatNumber(unitStats.shieldPower)}`,
		`Weapon ${DescriptionFormat.formatNumber(unitStats.weaponPower)}`,
	];

	if (unitStats.space !== undefined && unitStats.space > 0)
	{
		statParts.push(`Cargo ${DescriptionFormat.formatNumber(unitStats.space)}`);
	}

	return statParts.join(" · ");
}

const UNIT_ROLE_DESCRIPTIONS: ReadonlyMap<GameType.UnitType, string> = new Map<GameType.UnitType, string>
([
	[GameType.UnitType.SmallTransport, "A light cargo ship for ferrying resources between your planets."],
	[GameType.UnitType.LargeTransport, "A heavy freighter that hauls large resource loads."],
	[GameType.UnitType.ColonyShip, "Settles a new colony on an empty planet slot, then is consumed."],
	[GameType.UnitType.Recycler, "Harvests the debris fields left behind after battles."],
	[GameType.UnitType.EspionageProbe, "A tiny, extremely fast probe that spies on rival planets."],
	[GameType.UnitType.RocketLauncher, "Cheap, expendable stationary defense against light attackers."],
	[GameType.UnitType.SolarSatellite, "An orbital satellite that generates energy for the planet."],
	[GameType.UnitType.InterplanetaryMissile, "An offensive missile that smashes enemy planetary defenses."],
	[GameType.UnitType.InterceptorMissile, "A defensive missile that shoots down incoming interplanetary missiles."],
	[GameType.UnitType.SmallShieldDome, "A planetary shield that absorbs incoming fire. Limit one per planet."],
	[GameType.UnitType.LargeShieldDome, "A reinforced planetary shield. Limit one per planet."],
	[GameType.UnitType.Deathstar, "A colossal mobile fortress powerful enough to destroy moons."],
	[GameType.UnitType.LightFighter, "A fast, cheap fighter — the backbone of any early fleet."],
	[GameType.UnitType.HeavyFighter, "A tougher fighter with more armour and firepower than the light fighter."],
	[GameType.UnitType.Cruiser, "A quick warship that excels against light fighters and rocket launchers."],
	[GameType.UnitType.Battleship, "A powerful, long-range warship built for sustained assaults."],
	[GameType.UnitType.Battlecruiser, "A fast capital-ship hunter that tears through larger warships."],
	[GameType.UnitType.Bomber, "A siege ship specialised in flattening planetary defenses."],
	[GameType.UnitType.Destroyer, "A heavy warship that devastates cruisers and light lasers."],
	[GameType.UnitType.LightLaser, "An affordable laser turret for planetary defense."],
	[GameType.UnitType.HeavyLaser, "A stronger, better-shielded laser turret."],
	[GameType.UnitType.IonCannon, "A defense turret with exceptionally strong shields."],
	[GameType.UnitType.GaussCannon, "A high-damage cannon that punches through heavy ships."],
	[GameType.UnitType.PlasmaTurret, "The most powerful planetary defense turret."],
]);

export function getUnitDescriptionLines(unitType: GameType.UnitType): string[]
{
	const unitStats: GameType.UnitStats = StaticDataHelper.getUnitStats(unitType);

	const roleDescription: string | undefined = UNIT_ROLE_DESCRIPTIONS.get(unitType);
	if (roleDescription === undefined)
	{
		throw new Error(`No unit description for unit type ${unitType}.`);
	}

	const unitStatsLine: string = buildUnitStatsLine(unitStats);

	const descriptionLines: string[] =
	[
		roleDescription,
		unitStatsLine,
	];

	return descriptionLines;
}
