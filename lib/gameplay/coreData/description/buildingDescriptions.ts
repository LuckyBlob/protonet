import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";

const BUILDING_DESCRIPTIONS: ReadonlyMap<GameType.BuildingType, string[]> = new Map<GameType.BuildingType, string[]>
([
	[GameType.BuildingType.MetalMine,
	[
		"Extracts metal from the planet's crust.",
		"Produces metal; output grows with each level but draws more energy.",
	]],
	[GameType.BuildingType.CrystalGrower,
	[
		"Grows crystal used for electronics and advanced ships.",
		"Produces crystal; output grows with each level but draws more energy.",
	]],
	[GameType.BuildingType.DeuteriumSynthesizer,
	[
		"Synthesises deuterium, the fuel for your fleets and reactors.",
		"Produces deuterium; output grows with each level and is higher on colder planets.",
	]],
	[GameType.BuildingType.SolarPlant,
	[
		"Converts sunlight into electricity.",
		"Produces energy to power your mines; output grows with each level.",
	]],
	[GameType.BuildingType.MetalStorage,
	[
		"Warehouses surplus metal.",
		"Raises your metal storage capacity with each level.",
	]],
	[GameType.BuildingType.CrystalContainement,
	[
		"Contains surplus crystal.",
		"Raises your crystal storage capacity with each level.",
	]],
	[GameType.BuildingType.DeuteriumTank,
	[
		"Stores surplus deuterium.",
		"Raises your deuterium storage capacity with each level.",
	]],
	[GameType.BuildingType.Shipyard,
	[
		"Constructs ships, defenses and missiles.",
		"Higher levels build units faster and unlock larger designs.",
	]],
	[GameType.BuildingType.RoboticFactory,
	[
		"Automates construction across the planet.",
		"Higher levels speed up building construction.",
	]],
	[GameType.BuildingType.ResearchLab,
	[
		"Houses your scientists and their experiments.",
		"Higher levels research technologies faster; only one research runs at a time.",
	]],
	[GameType.BuildingType.NaniteFactory,
	[
		"Unleashes nanite swarms that assemble structures at incredible speed.",
		"Higher levels massively speed up building and unit construction.",
	]],
	[GameType.BuildingType.FusionReactor,
	[
		"Burns deuterium to generate large amounts of energy.",
		"Produces energy; output grows with each level and scales with Energy Technology.",
	]],
	[GameType.BuildingType.Terraformer,
	[
		"Reshapes the planet to expand its usable land.",
		"Each level adds building fields. Cannot be dismantled.",
	]],
	[GameType.BuildingType.LunarBase,
	[
		"Establishes a permanent base on the moon.",
		"Required for every other moon building; each level expands the moon's fields.",
	]],
	[GameType.BuildingType.MissileSilo,
	[
		"Stores and launches your missiles.",
		"Each level adds missile storage capacity.",
	]],
	[GameType.BuildingType.SensorPhalanx,
	[
		"Scans distant planets from the surface of your moon.",
		"Higher levels extend the scan range.",
	]],
	[GameType.BuildingType.JumpGate,
	[
		"Opens a hyperspace corridor between your moons.",
		"Instantly moves units from moon to moon at no resource cost, then must recharge.",
	]],
	[GameType.BuildingType.RepairDock,
	[
		"Salvages and repairs ships wrecked in battle.",
		"Higher levels repair more of your destroyed ships.",
	]],
]);

export function getBuildingDescriptionLines(buildingType: GameType.BuildingType): string[]
{
	const descriptionLines: string[] | undefined = BUILDING_DESCRIPTIONS.get(buildingType);
	if (descriptionLines === undefined)
	{
		throw new Error(`No building description for building type ${buildingType}.`);
	}

	return descriptionLines;
}
