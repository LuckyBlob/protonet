import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as ThingType from "@/lib/gameplay/coreData/thing/thingTypes";
import * as RequirementType from "@/lib/gameplay/coreData/requirement/requirementTypes";
import * as RequirementValueGetters from "@/lib/gameplay/coreData/requirement/requirementValueGetters";

//#region Buildings
const LUNAR_BASE_REQUIREMENT: RequirementType.Requirement =
{
	hideDataWhenRequirementFailed: true,
	applicableZones: [GameType.PlanetZone.Moon],
	thingType: ThingType.Thing.Building,
	specificThingType: GameType.BuildingType.LunarBase,
	condition: RequirementValueGetters.BUILDING_LEVEL,
	operator: RequirementType.RequirementOperator.GreaterOrEqual,
	value: 1,
};

const FREE_FIELD_REQUIREMENT: RequirementType.Requirement =
{
	hideDataWhenRequirementFailed: true,
	thingType: ThingType.Thing.PlanetValue,
	specificThingType: GameType.PlanetValueType.Size,
	condition: RequirementValueGetters.FREE_SIZE,
	operator: RequirementType.RequirementOperator.GreaterThan,
	value: 0,
};

const FIELD_CONSUMPTION_PLANET_VALUE: GameType.PlanetValueStat =
{
	planetValueProductionFormulasType: GameType.PlanetValueProductionFormulasType.LinearPerLevel,
	planetValueType: GameType.PlanetValueType.Size,
	basePlanetValueFactor: -1,
};

export const BUILDING_STATS: ReadonlyMap<GameType.BuildingType, GameType.BuildingStats> = new Map<GameType.BuildingType, GameType.BuildingStats>
([
    [GameType.BuildingType.MetalMine, { displayName: "Metal Mine",
		buildableZones: [GameType.PlanetZone.Planet],
		upgradeRequirements: [
			FREE_FIELD_REQUIREMENT],
		costFunctionType: GameType.BuildingCostFunctionType.SimpleExponential,
		costStats: {
			baseCostExponent: 1.5,
			baseCost: new Map<GameType.ResourceType, number>([
				[GameType.ResourceType.Metal, 60],
				[GameType.ResourceType.Crystal, 15],]),},

		productionFunctionType: GameType.ProductionFunctionType.SimpleProductionBuilding,
		productionStats: new Map<GameType.ResourceType, GameType.ProductionStats>([
			[GameType.ResourceType.Metal, {
				minProductionPerHour: 30,
				productionFactor: 30,
				exponentBase: 1.1,}]]),

		planetValueStats: [
			FIELD_CONSUMPTION_PLANET_VALUE,
			{planetValueProductionFormulasType:
				GameType.PlanetValueProductionFormulasType.SimpleExponentialBuildingEnergyThrottled,
				planetValueType: GameType.PlanetValueType.Energy,
				basePlanetValueFactor: -10,
				basePlanetValueExponent: 1.1,}],
	}],


	[GameType.BuildingType.MetalStorage, { displayName: "Metal Storage",
		buildableZones: [GameType.PlanetZone.Planet, GameType.PlanetZone.Moon],
		upgradeRequirements: [
			FREE_FIELD_REQUIREMENT,
			LUNAR_BASE_REQUIREMENT],
		costFunctionType: GameType.BuildingCostFunctionType.SimpleExponential,
		costStats: {
			baseCostExponent: 2,
			baseCost: new Map<GameType.ResourceType, number>([
				[GameType.ResourceType.Metal, 1000],]),},

		planetValueStats: [
			FIELD_CONSUMPTION_PLANET_VALUE,
			{planetValueProductionFormulasType:
				GameType.PlanetValueProductionFormulasType.FlooredNaturalExponential,
				planetValueType: GameType.PlanetValueType.MetalStorage,
				basePlanetValueFactor: 5000,
				naturalExponentialFactor: 2.5,
				naturalExponentialExponentFactor: 20/33,}],
	}],


	[GameType.BuildingType.CrystalGrower, { displayName: "Crystal Grower",
		buildableZones: [GameType.PlanetZone.Planet],
		upgradeRequirements: [
			FREE_FIELD_REQUIREMENT],
		costFunctionType: GameType.BuildingCostFunctionType.SimpleExponential,
		costStats: {
			baseCostExponent: 1.6,
			baseCost: new Map<GameType.ResourceType, number>([
				[GameType.ResourceType.Metal, 48],
				[GameType.ResourceType.Crystal, 24],]),},

		productionFunctionType: GameType.ProductionFunctionType.SimpleProductionBuilding,
		productionStats: new Map<GameType.ResourceType, GameType.ProductionStats>([
			[GameType.ResourceType.Crystal, {
				minProductionPerHour: 15,
				productionFactor: 20,
				exponentBase: 1.1,}]]),

		planetValueStats: [
			FIELD_CONSUMPTION_PLANET_VALUE,
			{planetValueProductionFormulasType:
				GameType.PlanetValueProductionFormulasType.SimpleExponentialBuildingEnergyThrottled,
				planetValueType: GameType.PlanetValueType.Energy,
				basePlanetValueFactor: -10,
				basePlanetValueExponent: 1.1,}],
	}],


	[GameType.BuildingType.CrystalContainement, { displayName: "Crystal Containement",
		buildableZones: [GameType.PlanetZone.Planet, GameType.PlanetZone.Moon],
		upgradeRequirements: [
			FREE_FIELD_REQUIREMENT,
			LUNAR_BASE_REQUIREMENT],
		costFunctionType: GameType.BuildingCostFunctionType.SimpleExponential,
		costStats: {
			baseCostExponent: 2,
			baseCost: new Map<GameType.ResourceType, number>([
				[GameType.ResourceType.Metal, 1000],
				[GameType.ResourceType.Crystal, 500],]),},

		planetValueStats: [
			FIELD_CONSUMPTION_PLANET_VALUE,
			{planetValueProductionFormulasType:
				GameType.PlanetValueProductionFormulasType.FlooredNaturalExponential,
				planetValueType: GameType.PlanetValueType.CrystalStorage,
				basePlanetValueFactor: 5000,
				naturalExponentialFactor: 2.5,
				naturalExponentialExponentFactor: 20/33,}],
	}],


	[GameType.BuildingType.DeuteriumSynthesizer, { displayName: "Deuterium Synthesizer",
		buildableZones: [GameType.PlanetZone.Planet],
		upgradeRequirements: [
			FREE_FIELD_REQUIREMENT],
		costFunctionType: GameType.BuildingCostFunctionType.SimpleExponential,
		costStats: {
			baseCostExponent: 1.5,
			baseCost: new Map<GameType.ResourceType, number>([
				[GameType.ResourceType.Metal, 225],
				[GameType.ResourceType.Crystal, 75],]),},

		productionFunctionType: GameType.ProductionFunctionType.TemperatureScaledProductionBuilding,
		productionStats: new Map<GameType.ResourceType, GameType.ProductionStats>([
			[GameType.ResourceType.Deuterium, {
				minProductionPerHour: 0,
				productionFactor: 10,
				exponentBase: 1.1,}]]),

		planetValueStats: [
			FIELD_CONSUMPTION_PLANET_VALUE,
			{planetValueProductionFormulasType:
				GameType.PlanetValueProductionFormulasType.SimpleExponentialBuildingEnergyThrottled,
				planetValueType: GameType.PlanetValueType.Energy,
				basePlanetValueFactor: -20,
				basePlanetValueExponent: 1.1,}],
	}],


	[GameType.BuildingType.DeuteriumTank, { displayName: "Deuterium Tank",
		buildableZones: [GameType.PlanetZone.Planet, GameType.PlanetZone.Moon],
		upgradeRequirements: [
			FREE_FIELD_REQUIREMENT,
			LUNAR_BASE_REQUIREMENT],
		costFunctionType: GameType.BuildingCostFunctionType.SimpleExponential,
		costStats: {
			baseCostExponent: 2,
			baseCost: new Map<GameType.ResourceType, number>([
				[GameType.ResourceType.Metal, 1000],
				[GameType.ResourceType.Crystal, 1000],]),},

		planetValueStats: [
			FIELD_CONSUMPTION_PLANET_VALUE,
			{planetValueProductionFormulasType:
				GameType.PlanetValueProductionFormulasType.FlooredNaturalExponential,
				planetValueType: GameType.PlanetValueType.DeuteriumStorage,
				basePlanetValueFactor: 5000,
				naturalExponentialFactor: 2.5,
				naturalExponentialExponentFactor: 20/33,}],
	}],


	[GameType.BuildingType.SolarPlant, { displayName: "Solar Plant",
		buildableZones: [GameType.PlanetZone.Planet],
		upgradeRequirements: [
			FREE_FIELD_REQUIREMENT],
		costFunctionType: GameType.BuildingCostFunctionType.SimpleExponential,
		costStats: {
			baseCostExponent: 1.5,
			baseCost: new Map<GameType.ResourceType, number>([
				[GameType.ResourceType.Metal, 75],
				[GameType.ResourceType.Crystal, 30],]),},

		planetValueStats: [
			FIELD_CONSUMPTION_PLANET_VALUE,
			{planetValueProductionFormulasType:
				GameType.PlanetValueProductionFormulasType.SimpleExponentialBuildingEnergyThrottled,
				planetValueType: GameType.PlanetValueType.Energy,
				basePlanetValueFactor: 20,
				basePlanetValueExponent: 1.1,}],
	}],


	[GameType.BuildingType.Shipyard, { displayName: "Shipyard",
		buildableZones: [GameType.PlanetZone.Planet, GameType.PlanetZone.Moon],
		planetValueStats: [
			FIELD_CONSUMPTION_PLANET_VALUE],
		upgradeRequirements: [
			FREE_FIELD_REQUIREMENT,
		{
			hideDataWhenRequirementFailed: true,
			thingType: ThingType.Thing.Building,
			specificThingType: GameType.BuildingType.RoboticFactory,
			condition: RequirementValueGetters.BUILDING_LEVEL,
			operator: RequirementType.RequirementOperator.GreaterOrEqual,
			value: 2,},
			LUNAR_BASE_REQUIREMENT,
		{
			hideDataWhenRequirementFailed: false,
			condition: RequirementValueGetters.IS_ANY_UNIT_BEING_CONSTRUCTED,
			operator: RequirementType.RequirementOperator.Equal,
			value: false,},],
		costFunctionType: GameType.BuildingCostFunctionType.SimpleExponential,
		costStats: {
			baseCostExponent: 2,
			baseCost: new Map<GameType.ResourceType, number>([
				[GameType.ResourceType.Metal, 400],
				[GameType.ResourceType.Crystal, 200],
				[GameType.ResourceType.Deuterium, 100],]),},
	},],


	[GameType.BuildingType.RoboticFactory, { displayName: "Robotic Factory",
		buildableZones: [GameType.PlanetZone.Planet, GameType.PlanetZone.Moon],
		planetValueStats: [
			FIELD_CONSUMPTION_PLANET_VALUE],
		upgradeRequirements: [
			FREE_FIELD_REQUIREMENT,
			LUNAR_BASE_REQUIREMENT],
		costFunctionType: GameType.BuildingCostFunctionType.SimpleExponential,
		costStats: {
			baseCostExponent: 2,
			baseCost: new Map<GameType.ResourceType, number>([
				[GameType.ResourceType.Metal, 400],
				[GameType.ResourceType.Crystal, 120],
				[GameType.ResourceType.Deuterium, 200],]),},
	},],

	[GameType.BuildingType.ResearchLab, { displayName: "Research Lab",
		buildableZones: [GameType.PlanetZone.Planet],
		planetValueStats: [
			FIELD_CONSUMPTION_PLANET_VALUE],
		upgradeRequirements: [
			FREE_FIELD_REQUIREMENT,
		{
			hideDataWhenRequirementFailed: false,
			condition: RequirementValueGetters.IS_ANY_RESEARCH_IN_PROGRESS,
			operator: RequirementType.RequirementOperator.Equal,
			value: false,},],
		deconstructRequirements:[
		{
			hideDataWhenRequirementFailed: false,
			condition: RequirementValueGetters.IS_ANY_RESEARCH_IN_PROGRESS,
			operator: RequirementType.RequirementOperator.Equal,
			value: false,},],
		costFunctionType: GameType.BuildingCostFunctionType.SimpleExponential,
		costStats: {
			baseCostExponent: 2,
			baseCost: new Map<GameType.ResourceType, number>([
				[GameType.ResourceType.Metal, 200],
				[GameType.ResourceType.Crystal, 400],
				[GameType.ResourceType.Deuterium, 200],]),},
	},],

	[GameType.BuildingType.NaniteFactory, { displayName: "Nanite Factory",
		buildableZones: [GameType.PlanetZone.Planet],
		planetValueStats: [
			FIELD_CONSUMPTION_PLANET_VALUE],
		upgradeRequirements: [
			FREE_FIELD_REQUIREMENT,
		{
			hideDataWhenRequirementFailed: true,
			thingType: ThingType.Thing.Building,
			specificThingType: GameType.BuildingType.RoboticFactory,
			condition: RequirementValueGetters.BUILDING_LEVEL,
			operator: RequirementType.RequirementOperator.GreaterOrEqual,
			value: 10,},
		{
			hideDataWhenRequirementFailed: true,
			thingType: ThingType.Thing.Research,
			specificThingType: GameType.ResearchType.ComputerTech,
			condition: RequirementValueGetters.RESEARCH_LEVEL,
			operator: RequirementType.RequirementOperator.GreaterOrEqual,
			value: 10,},
		{
			hideDataWhenRequirementFailed: false,
			condition: RequirementValueGetters.IS_ANY_UNIT_BEING_CONSTRUCTED,
			operator: RequirementType.RequirementOperator.Equal,
			value: false,},],
		costFunctionType: GameType.BuildingCostFunctionType.SimpleExponential,
		costStats: {
			baseCostExponent: 2,
			baseCost: new Map<GameType.ResourceType, number>([
				[GameType.ResourceType.Metal, 1000000],
				[GameType.ResourceType.Crystal, 500000],
				[GameType.ResourceType.Deuterium, 100000],]),},
	},],

	[GameType.BuildingType.FusionReactor, { displayName: "Fusion Reactor",
		buildableZones: [GameType.PlanetZone.Planet],
		upgradeRequirements: [
			FREE_FIELD_REQUIREMENT,
		{
			hideDataWhenRequirementFailed: true,
			thingType: ThingType.Thing.Building,
			specificThingType: GameType.BuildingType.DeuteriumSynthesizer,
			condition: RequirementValueGetters.BUILDING_LEVEL,
			operator: RequirementType.RequirementOperator.GreaterOrEqual,
			value: 5,},
		{
			hideDataWhenRequirementFailed: true,
			thingType: ThingType.Thing.Research,
			specificThingType: GameType.ResearchType.EnergyTech,
			condition: RequirementValueGetters.RESEARCH_LEVEL,
			operator: RequirementType.RequirementOperator.GreaterOrEqual,
			value: 3,},],
		costFunctionType: GameType.BuildingCostFunctionType.SimpleExponential,
		costStats: {
			baseCostExponent: 1.8,
			baseCost: new Map<GameType.ResourceType, number>([
				[GameType.ResourceType.Metal, 900],
				[GameType.ResourceType.Crystal, 360],
				[GameType.ResourceType.Deuterium, 180],]),},

		productionFunctionType: GameType.ProductionFunctionType.SimpleProductionBuilding,
		productionStats: new Map<GameType.ResourceType, GameType.ProductionStats>([
			[GameType.ResourceType.Deuterium, {
				minProductionPerHour: 0,
				productionFactor: -10,
				exponentBase: 1.1,}]]),

		planetValueStats: [
			FIELD_CONSUMPTION_PLANET_VALUE,
			{planetValueProductionFormulasType:
				GameType.PlanetValueProductionFormulasType.ResearchScaledExponentialBuildingEnergyThrottled,
				planetValueType: GameType.PlanetValueType.Energy,
				basePlanetValueFactor: 30,
				researchScalingResearchType: GameType.ResearchType.EnergyTech,
				researchScalingBaseFactor: 1.05,
				researchScalingPerLevelFactor: 0.01,}],
	},],

	[GameType.BuildingType.Terraformer, { displayName: "Terraformer",
		buildableZones: [GameType.PlanetZone.Planet],
		canDeconstruct: false,
		upgradeRequirements: [
			FREE_FIELD_REQUIREMENT,
		{
			hideDataWhenRequirementFailed: true,
			thingType: ThingType.Thing.Building,
			specificThingType: GameType.BuildingType.NaniteFactory,
			condition: RequirementValueGetters.BUILDING_LEVEL,
			operator: RequirementType.RequirementOperator.GreaterOrEqual,
			value: 1,},
		{
			hideDataWhenRequirementFailed: true,
			thingType: ThingType.Thing.Research,
			specificThingType: GameType.ResearchType.EnergyTech,
			condition: RequirementValueGetters.RESEARCH_LEVEL,
			operator: RequirementType.RequirementOperator.GreaterOrEqual,
			value: 12,},],
		costFunctionType: GameType.BuildingCostFunctionType.SimpleExponential,
		costStats: {
			baseCostExponent: 2,
			baseCost: new Map<GameType.ResourceType, number>([
				[GameType.ResourceType.Crystal, 50000],
				[GameType.ResourceType.Deuterium, 100000],]),},

		planetValueStats: [
			FIELD_CONSUMPTION_PLANET_VALUE,
			{planetValueProductionFormulasType:
				GameType.PlanetValueProductionFormulasType.SimpleExponential,
				planetValueType: GameType.PlanetValueType.Size,
				basePlanetValueFactor: 5.5,
				basePlanetValueExponent: 1,}],
	},],

	[GameType.BuildingType.LunarBase, { displayName: "Lunar Base",
		buildableZones: [GameType.PlanetZone.Moon],
		upgradeRequirements: [
			FREE_FIELD_REQUIREMENT],
		canDeconstruct: false,
		costFunctionType: GameType.BuildingCostFunctionType.SimpleExponential,
		costStats: {
			baseCostExponent: 2,
			baseCost: new Map<GameType.ResourceType, number>([
				[GameType.ResourceType.Metal, 20000],
				[GameType.ResourceType.Crystal, 40000],
				[GameType.ResourceType.Deuterium, 20000],]),},

		planetValueStats: [
			FIELD_CONSUMPTION_PLANET_VALUE,
			{planetValueProductionFormulasType:
				GameType.PlanetValueProductionFormulasType.SimpleExponential,
				planetValueType: GameType.PlanetValueType.Size,
				basePlanetValueFactor: 3,
				basePlanetValueExponent: 1,}],
	},],

	[GameType.BuildingType.MissileSilo, { displayName: "Missile Silo",
		buildableZones: [GameType.PlanetZone.Planet],
		upgradeRequirements: [
			FREE_FIELD_REQUIREMENT,
		{
			hideDataWhenRequirementFailed: true,
			thingType: ThingType.Thing.Building,
			specificThingType: GameType.BuildingType.Shipyard,
			condition: RequirementValueGetters.BUILDING_LEVEL,
			operator: RequirementType.RequirementOperator.GreaterOrEqual,
			value: 1,},],
		costFunctionType: GameType.BuildingCostFunctionType.SimpleExponential,
		costStats: {
			baseCostExponent: 2,
			baseCost: new Map<GameType.ResourceType, number>([
				[GameType.ResourceType.Metal, 20000],
				[GameType.ResourceType.Crystal, 20000],
				[GameType.ResourceType.Deuterium, 1000],]),},

		planetValueStats: [
			FIELD_CONSUMPTION_PLANET_VALUE,
			{planetValueProductionFormulasType:
				GameType.PlanetValueProductionFormulasType.SimpleExponential,
				planetValueType: GameType.PlanetValueType.MissileSpace,
				basePlanetValueFactor: 10,
				basePlanetValueExponent: 1,}],
	},],

	[GameType.BuildingType.SensorPhalanx, { displayName: "Sensor Phalanx",
		buildableZones: [GameType.PlanetZone.Moon],
		planetValueStats: [
			FIELD_CONSUMPTION_PLANET_VALUE],
		upgradeRequirements: [
			FREE_FIELD_REQUIREMENT,
			LUNAR_BASE_REQUIREMENT],
		costFunctionType: GameType.BuildingCostFunctionType.SimpleExponential,
		costStats: {
			baseCostExponent: 2,
			baseCost: new Map<GameType.ResourceType, number>([
				[GameType.ResourceType.Metal, 20000],
				[GameType.ResourceType.Crystal, 40000],
				[GameType.ResourceType.Deuterium, 20000],]),},
	},],

	[GameType.BuildingType.JumpGate, { displayName: "Jump Gate",
		buildableZones: [GameType.PlanetZone.Moon],
		planetValueStats: [
			FIELD_CONSUMPTION_PLANET_VALUE],
		upgradeRequirements: [
			FREE_FIELD_REQUIREMENT,
			LUNAR_BASE_REQUIREMENT,
		{
			hideDataWhenRequirementFailed: true,
			thingType: ThingType.Thing.Research,
			specificThingType: GameType.ResearchType.HyperspaceTech,
			condition: RequirementValueGetters.RESEARCH_LEVEL,
			operator: RequirementType.RequirementOperator.GreaterOrEqual,
			value: 7,},],
		costFunctionType: GameType.BuildingCostFunctionType.SimpleExponential,
		costStats: {
			baseCostExponent: 2,
			baseCost: new Map<GameType.ResourceType, number>([
				[GameType.ResourceType.Metal, 2000000],
				[GameType.ResourceType.Crystal, 4000000],
				[GameType.ResourceType.Deuterium, 2000000],]),},
	},],
	[GameType.BuildingType.RepairDock, { displayName: "Repair Dock",
		buildableZones: [GameType.PlanetZone.Planet],
		costFunctionType: GameType.BuildingCostFunctionType.SimpleExponential,
		costStats: {
			baseCostExponent: 5,
			baseCost: new Map<GameType.ResourceType, number>([
				[GameType.ResourceType.Metal, 200],
				[GameType.ResourceType.Deuterium, 50],]),},
	},],
]);
//#endregion

//#region Units
export const UNIT_STATS: ReadonlyMap<GameType.UnitType, GameType.UnitStats> = new Map<GameType.UnitType, GameType.UnitStats>
([
    [GameType.UnitType.SmallTransport, { displayName: "Small Transport",
		canGenerateDebris: true,
		canBeRepairedAtRepairDock: true,
		participatesInCombat: true,
		category: GameType.UnitCategory.Ship,
		queueType: GameType.UnitConstructionQueueType.Shipyard,
		requirements:[
		{
			thingType: ThingType.Thing.Building,
			specificThingType: GameType.BuildingType.Shipyard,
			condition: RequirementValueGetters.BUILDING_LEVEL,
			operator: RequirementType.RequirementOperator.GreaterOrEqual,
			value: 2,},
		{
			thingType: ThingType.Thing.Research,
			specificThingType: GameType.ResearchType.CombustionDrive,
			condition: RequirementValueGetters.RESEARCH_LEVEL,
			operator: RequirementType.RequirementOperator.GreaterOrEqual,
			value: 2,},],
		costMap: new Map<GameType.ResourceType, number>([
			[GameType.ResourceType.Metal, 2000],
			[GameType.ResourceType.Crystal, 2000],]),
		maxHealth: 4000,
		shieldPower: 10,
		weaponPower: 5,
		rapidFire: new Map<GameType.UnitType, number>([
			[GameType.UnitType.EspionageProbe, 5],
			[GameType.UnitType.SolarSatellite, 5],]),
		space: 5000,
		speed: {
			speedFunctionType: GameType.SpeedFunctionType.EngineDrive,
			engineTechData: [
				{ engineTech: GameType.ResearchType.CombustionDrive, researchLevel: 0, value: 5000},
				{ engineTech: GameType.ResearchType.ImpulseDrive, researchLevel: 5, value: 10000}]},
		baseFuelConsumption: [
			{ engineTech: GameType.ResearchType.CombustionDrive, researchLevel:0, value: new Map<GameType.ResourceType, number>([[GameType.ResourceType.Deuterium, 10]])},
			{ engineTech: GameType.ResearchType.ImpulseDrive, researchLevel:5, value: new Map<GameType.ResourceType, number>([[GameType.ResourceType.Deuterium, 20]])},],
	}],


    [GameType.UnitType.LargeTransport, { displayName: "Large Transport",
		canGenerateDebris: true,
		canBeRepairedAtRepairDock: true,
		participatesInCombat: true,
		category: GameType.UnitCategory.Ship,
		queueType: GameType.UnitConstructionQueueType.Shipyard,
		requirements:[
		{
			thingType: ThingType.Thing.Building,
			specificThingType: GameType.BuildingType.Shipyard,
			condition: RequirementValueGetters.BUILDING_LEVEL,
			operator: RequirementType.RequirementOperator.GreaterOrEqual,
			value: 4,},
		{
			thingType: ThingType.Thing.Research,
			specificThingType: GameType.ResearchType.CombustionDrive,
			condition: RequirementValueGetters.RESEARCH_LEVEL,
			operator: RequirementType.RequirementOperator.GreaterOrEqual,
			value: 6,},],
		costMap: new Map<GameType.ResourceType, number>([
			[GameType.ResourceType.Metal, 6000],
			[GameType.ResourceType.Crystal, 6000],]),
		maxHealth: 12000,
		shieldPower: 25,
		weaponPower: 5,
		rapidFire: new Map<GameType.UnitType, number>([
			[GameType.UnitType.EspionageProbe, 5],
			[GameType.UnitType.SolarSatellite, 5],]),
		space: 25000,
		speed: {
			speedFunctionType: GameType.SpeedFunctionType.EngineDrive,
			engineTechData: [
				{ engineTech: GameType.ResearchType.CombustionDrive, researchLevel: 0, value: 7500}]},
		baseFuelConsumption: [
			{ engineTech: GameType.ResearchType.CombustionDrive, researchLevel: 0, value: new Map<GameType.ResourceType, number>([[GameType.ResourceType.Deuterium, 50]])},],
	}],


    [GameType.UnitType.ColonyShip, { displayName: "Colony Ship",
		canGenerateDebris: true,
		canBeRepairedAtRepairDock: true,
		participatesInCombat: true,
		participatesInColonization: true,
		category: GameType.UnitCategory.Ship,
		queueType: GameType.UnitConstructionQueueType.Shipyard,
		requirements:[
		{
			thingType: ThingType.Thing.Building,
			specificThingType: GameType.BuildingType.Shipyard,
			condition: RequirementValueGetters.BUILDING_LEVEL,
			operator: RequirementType.RequirementOperator.GreaterOrEqual,
			value: 4,},
		{
			thingType: ThingType.Thing.Research,
			specificThingType: GameType.ResearchType.ImpulseDrive,
			condition: RequirementValueGetters.RESEARCH_LEVEL,
			operator: RequirementType.RequirementOperator.GreaterOrEqual,
			value: 3,},],
		costMap: new Map<GameType.ResourceType, number>([
			[GameType.ResourceType.Metal, 10000],
			[GameType.ResourceType.Crystal, 20000],
			[GameType.ResourceType.Deuterium, 10000],]),
		maxHealth: 30000,
		shieldPower: 100,
		weaponPower: 50,
		rapidFire: new Map<GameType.UnitType, number>([
			[GameType.UnitType.EspionageProbe, 5],
			[GameType.UnitType.SolarSatellite, 5],]),
		space: 7500,
		speed: {
			speedFunctionType: GameType.SpeedFunctionType.EngineDrive,
			engineTechData: [
				{ engineTech: GameType.ResearchType.ImpulseDrive, researchLevel: 0, value: 2500}]},
		baseFuelConsumption: [
			{ engineTech: GameType.ResearchType.ImpulseDrive, researchLevel: 0, value: new Map<GameType.ResourceType, number>([[GameType.ResourceType.Deuterium, 1000]])},],
	}],
    [GameType.UnitType.Recycler, { displayName: "Recycler",
		canGenerateDebris: true,
		canBeRepairedAtRepairDock: true,
		participatesInCombat: true,
		category: GameType.UnitCategory.Ship,
		queueType: GameType.UnitConstructionQueueType.Shipyard,
		requirements:[
		{
			thingType: ThingType.Thing.Building,
			specificThingType: GameType.BuildingType.Shipyard,
			condition: RequirementValueGetters.BUILDING_LEVEL,
			operator: RequirementType.RequirementOperator.GreaterOrEqual,
			value: 4,},
		{
			thingType: ThingType.Thing.Research,
			specificThingType: GameType.ResearchType.CombustionDrive,
			condition: RequirementValueGetters.RESEARCH_LEVEL,
			operator: RequirementType.RequirementOperator.GreaterOrEqual,
			value: 6,},
		{
			thingType: ThingType.Thing.Research,
			specificThingType: GameType.ResearchType.ShieldingTech,
			condition: RequirementValueGetters.RESEARCH_LEVEL,
			operator: RequirementType.RequirementOperator.GreaterOrEqual,
			value: 2,},],
		costMap: new Map<GameType.ResourceType, number>([
			[GameType.ResourceType.Metal, 10000],
			[GameType.ResourceType.Crystal, 6000],
			[GameType.ResourceType.Deuterium, 2000],]),
		maxHealth: 16000,
		shieldPower: 10,
		weaponPower: 1,
		rapidFire: new Map<GameType.UnitType, number>([
			[GameType.UnitType.EspionageProbe, 5],
			[GameType.UnitType.SolarSatellite, 5],]),
		space: 20000,
		speed: {
			speedFunctionType: GameType.SpeedFunctionType.EngineDrive,
			engineTechData: [
				{ engineTech: GameType.ResearchType.CombustionDrive, researchLevel: 0, value: 2000},
				{ engineTech: GameType.ResearchType.ImpulseDrive, researchLevel: 17, value: 4000},
				{ engineTech: GameType.ResearchType.HyperspaceDrive, researchLevel: 15, value: 6000}]},
		baseFuelConsumption: [
			{ engineTech: GameType.ResearchType.CombustionDrive, researchLevel: 0, value: new Map<GameType.ResourceType, number>([[GameType.ResourceType.Deuterium, 300]])},
			{ engineTech: GameType.ResearchType.ImpulseDrive, researchLevel: 17, value: new Map<GameType.ResourceType, number>([[GameType.ResourceType.Deuterium, 600]])},
			{ engineTech: GameType.ResearchType.HyperspaceDrive, researchLevel: 15, value: new Map<GameType.ResourceType, number>([[GameType.ResourceType.Deuterium, 900]])},],
		canTargetDebrisField: true,
	}],
	[GameType.UnitType.EspionageProbe, { displayName: "Espionage Probe",
		canGenerateDebris: true,
		participatesInCombat: true,
		category: GameType.UnitCategory.Ship,
		queueType: GameType.UnitConstructionQueueType.Shipyard,
		requirements:[
		{
			thingType: ThingType.Thing.Building,
			specificThingType: GameType.BuildingType.Shipyard,
			condition: RequirementValueGetters.BUILDING_LEVEL,
			operator: RequirementType.RequirementOperator.GreaterOrEqual,
			value: 3,},
		{
			thingType: ThingType.Thing.Research,
			specificThingType: GameType.ResearchType.EspionageTech,
			condition: RequirementValueGetters.RESEARCH_LEVEL,
			operator: RequirementType.RequirementOperator.GreaterOrEqual,
			value: 2,},
		{
			thingType: ThingType.Thing.Research,
			specificThingType: GameType.ResearchType.CombustionDrive,
			condition: RequirementValueGetters.RESEARCH_LEVEL,
			operator: RequirementType.RequirementOperator.GreaterOrEqual,
			value: 3,},],
		costMap: new Map<GameType.ResourceType, number>([
			[GameType.ResourceType.Crystal, 1000],]),
		maxHealth: 1000,
		shieldPower: 0,
		weaponPower: 0,
		space: 5,
		speed: {
			speedFunctionType: GameType.SpeedFunctionType.EngineDrive,
			engineTechData: [
				{ engineTech: GameType.ResearchType.CombustionDrive, researchLevel: 0, value: 100000000}]},
		baseFuelConsumption: [
			{ engineTech: GameType.ResearchType.CombustionDrive, researchLevel: 0, value: new Map<GameType.ResourceType, number>([[GameType.ResourceType.Deuterium, 1]])},],
		canSpy: true,
	}],
	[GameType.UnitType.LightFighter, { displayName: "Light Fighter",
		canGenerateDebris: true,
		canBeRepairedAtRepairDock: true,
		participatesInCombat: true,
		category: GameType.UnitCategory.Ship,
		queueType: GameType.UnitConstructionQueueType.Shipyard,
		requirements:[
		{
			thingType: ThingType.Thing.Building,
			specificThingType: GameType.BuildingType.Shipyard,
			condition: RequirementValueGetters.BUILDING_LEVEL,
			operator: RequirementType.RequirementOperator.GreaterOrEqual,
			value: 1,},
		{
			thingType: ThingType.Thing.Research,
			specificThingType: GameType.ResearchType.CombustionDrive,
			condition: RequirementValueGetters.RESEARCH_LEVEL,
			operator: RequirementType.RequirementOperator.GreaterOrEqual,
			value: 1,},],
		costMap: new Map<GameType.ResourceType, number>([
			[GameType.ResourceType.Metal, 3000],
			[GameType.ResourceType.Crystal, 1000],]),
		maxHealth: 4000,
		shieldPower: 10,
		weaponPower: 50,
		rapidFire: new Map<GameType.UnitType, number>([
			[GameType.UnitType.EspionageProbe, 5],
			[GameType.UnitType.SolarSatellite, 5],]),
		space: 50,
		speed: {
			speedFunctionType: GameType.SpeedFunctionType.EngineDrive,
			engineTechData: [
				{ engineTech: GameType.ResearchType.CombustionDrive, researchLevel: 0, value: 12500}]},
		baseFuelConsumption: [
			{ engineTech: GameType.ResearchType.CombustionDrive, researchLevel: 0, value: new Map<GameType.ResourceType, number>([[GameType.ResourceType.Deuterium, 20]])},],
	}],

	[GameType.UnitType.HeavyFighter, { displayName: "Heavy Fighter",
		canGenerateDebris: true,
		canBeRepairedAtRepairDock: true,
		participatesInCombat: true,
		category: GameType.UnitCategory.Ship,
		queueType: GameType.UnitConstructionQueueType.Shipyard,
		requirements:[
		{
			thingType: ThingType.Thing.Building,
			specificThingType: GameType.BuildingType.Shipyard,
			condition: RequirementValueGetters.BUILDING_LEVEL,
			operator: RequirementType.RequirementOperator.GreaterOrEqual,
			value: 3,},
		{
			thingType: ThingType.Thing.Research,
			specificThingType: GameType.ResearchType.ImpulseDrive,
			condition: RequirementValueGetters.RESEARCH_LEVEL,
			operator: RequirementType.RequirementOperator.GreaterOrEqual,
			value: 2,},
		{
			thingType: ThingType.Thing.Research,
			specificThingType: GameType.ResearchType.ArmourTech,
			condition: RequirementValueGetters.RESEARCH_LEVEL,
			operator: RequirementType.RequirementOperator.GreaterOrEqual,
			value: 2,},],
		costMap: new Map<GameType.ResourceType, number>([
			[GameType.ResourceType.Metal, 6000],
			[GameType.ResourceType.Crystal, 4000],]),
		maxHealth: 10000,
		shieldPower: 25,
		weaponPower: 150,
		rapidFire: new Map<GameType.UnitType, number>([
			[GameType.UnitType.EspionageProbe, 5],
			[GameType.UnitType.SolarSatellite, 5],
			[GameType.UnitType.SmallTransport, 3],]),
		space: 100,
		speed: {
			speedFunctionType: GameType.SpeedFunctionType.EngineDrive,
			engineTechData: [
				{ engineTech: GameType.ResearchType.ImpulseDrive, researchLevel: 0, value: 10000}]},
		baseFuelConsumption: [
			{ engineTech: GameType.ResearchType.ImpulseDrive, researchLevel: 0, value: new Map<GameType.ResourceType, number>([[GameType.ResourceType.Deuterium, 75]])},],
	}],

	[GameType.UnitType.Cruiser, { displayName: "Cruiser",
		canGenerateDebris: true,
		canBeRepairedAtRepairDock: true,
		participatesInCombat: true,
		category: GameType.UnitCategory.Ship,
		queueType: GameType.UnitConstructionQueueType.Shipyard,
		requirements:[
		{
			thingType: ThingType.Thing.Building,
			specificThingType: GameType.BuildingType.Shipyard,
			condition: RequirementValueGetters.BUILDING_LEVEL,
			operator: RequirementType.RequirementOperator.GreaterOrEqual,
			value: 5,},
		{
			thingType: ThingType.Thing.Research,
			specificThingType: GameType.ResearchType.ImpulseDrive,
			condition: RequirementValueGetters.RESEARCH_LEVEL,
			operator: RequirementType.RequirementOperator.GreaterOrEqual,
			value: 4,},
		{
			thingType: ThingType.Thing.Research,
			specificThingType: GameType.ResearchType.IonTech,
			condition: RequirementValueGetters.RESEARCH_LEVEL,
			operator: RequirementType.RequirementOperator.GreaterOrEqual,
			value: 2,},],
		costMap: new Map<GameType.ResourceType, number>([
			[GameType.ResourceType.Metal, 20000],
			[GameType.ResourceType.Crystal, 7000],
			[GameType.ResourceType.Deuterium, 2000],]),
		maxHealth: 27000,
		shieldPower: 50,
		weaponPower: 400,
		rapidFire: new Map<GameType.UnitType, number>([
			[GameType.UnitType.EspionageProbe, 5],
			[GameType.UnitType.SolarSatellite, 5],
			[GameType.UnitType.LightFighter, 6],
			[GameType.UnitType.RocketLauncher, 10],]),
		space: 800,
		speed: {
			speedFunctionType: GameType.SpeedFunctionType.EngineDrive,
			engineTechData: [
				{ engineTech: GameType.ResearchType.ImpulseDrive, researchLevel: 0, value: 15000}]},
		baseFuelConsumption: [
			{ engineTech: GameType.ResearchType.ImpulseDrive, researchLevel: 0, value: new Map<GameType.ResourceType, number>([[GameType.ResourceType.Deuterium, 300]])},],
	}],

	[GameType.UnitType.Battleship, { displayName: "Battleship",
		canGenerateDebris: true,
		canBeRepairedAtRepairDock: true,
		participatesInCombat: true,
		category: GameType.UnitCategory.Ship,
		queueType: GameType.UnitConstructionQueueType.Shipyard,
		requirements:[
		{
			thingType: ThingType.Thing.Building,
			specificThingType: GameType.BuildingType.Shipyard,
			condition: RequirementValueGetters.BUILDING_LEVEL,
			operator: RequirementType.RequirementOperator.GreaterOrEqual,
			value: 7,},
		{
			thingType: ThingType.Thing.Research,
			specificThingType: GameType.ResearchType.HyperspaceDrive,
			condition: RequirementValueGetters.RESEARCH_LEVEL,
			operator: RequirementType.RequirementOperator.GreaterOrEqual,
			value: 4,},],
		costMap: new Map<GameType.ResourceType, number>([
			[GameType.ResourceType.Metal, 45000],
			[GameType.ResourceType.Crystal, 15000],]),
		maxHealth: 60000,
		shieldPower: 200,
		weaponPower: 1000,
		rapidFire: new Map<GameType.UnitType, number>([
			[GameType.UnitType.EspionageProbe, 5],
			[GameType.UnitType.SolarSatellite, 5],]),
		space: 1500,
		speed: {
			speedFunctionType: GameType.SpeedFunctionType.EngineDrive,
			engineTechData: [
				{ engineTech: GameType.ResearchType.HyperspaceDrive, researchLevel: 0, value: 10000}]},
		baseFuelConsumption: [
			{ engineTech: GameType.ResearchType.HyperspaceDrive, researchLevel: 0, value: new Map<GameType.ResourceType, number>([[GameType.ResourceType.Deuterium, 500]])},],
	}],

	[GameType.UnitType.Battlecruiser, { displayName: "Battlecruiser",
		canGenerateDebris: true,
		canBeRepairedAtRepairDock: true,
		participatesInCombat: true,
		category: GameType.UnitCategory.Ship,
		queueType: GameType.UnitConstructionQueueType.Shipyard,
		requirements:[
		{
			thingType: ThingType.Thing.Building,
			specificThingType: GameType.BuildingType.Shipyard,
			condition: RequirementValueGetters.BUILDING_LEVEL,
			operator: RequirementType.RequirementOperator.GreaterOrEqual,
			value: 8,},
		{
			thingType: ThingType.Thing.Research,
			specificThingType: GameType.ResearchType.HyperspaceTech,
			condition: RequirementValueGetters.RESEARCH_LEVEL,
			operator: RequirementType.RequirementOperator.GreaterOrEqual,
			value: 5,},
		{
			thingType: ThingType.Thing.Research,
			specificThingType: GameType.ResearchType.HyperspaceDrive,
			condition: RequirementValueGetters.RESEARCH_LEVEL,
			operator: RequirementType.RequirementOperator.GreaterOrEqual,
			value: 5,},
		{
			thingType: ThingType.Thing.Research,
			specificThingType: GameType.ResearchType.LaserTech,
			condition: RequirementValueGetters.RESEARCH_LEVEL,
			operator: RequirementType.RequirementOperator.GreaterOrEqual,
			value: 12,},],
		costMap: new Map<GameType.ResourceType, number>([
			[GameType.ResourceType.Metal, 30000],
			[GameType.ResourceType.Crystal, 40000],
			[GameType.ResourceType.Deuterium, 15000],]),
		maxHealth: 70000,
		shieldPower: 400,
		weaponPower: 700,
		rapidFire: new Map<GameType.UnitType, number>([
			[GameType.UnitType.EspionageProbe, 5],
			[GameType.UnitType.SolarSatellite, 5],
			[GameType.UnitType.SmallTransport, 3],
			[GameType.UnitType.LargeTransport, 3],
			[GameType.UnitType.HeavyFighter, 4],
			[GameType.UnitType.Cruiser, 4],
			[GameType.UnitType.Battleship, 7],]),
		space: 750,
		speed: {
			speedFunctionType: GameType.SpeedFunctionType.EngineDrive,
			engineTechData: [
				{ engineTech: GameType.ResearchType.HyperspaceDrive, researchLevel: 0, value: 10000}]},
		baseFuelConsumption: [
			{ engineTech: GameType.ResearchType.HyperspaceDrive, researchLevel: 0, value: new Map<GameType.ResourceType, number>([[GameType.ResourceType.Deuterium, 250]])},],
	}],

	[GameType.UnitType.Bomber, { displayName: "Bomber",
		canGenerateDebris: true,
		canBeRepairedAtRepairDock: true,
		participatesInCombat: true,
		category: GameType.UnitCategory.Ship,
		queueType: GameType.UnitConstructionQueueType.Shipyard,
		requirements:[
		{
			thingType: ThingType.Thing.Building,
			specificThingType: GameType.BuildingType.Shipyard,
			condition: RequirementValueGetters.BUILDING_LEVEL,
			operator: RequirementType.RequirementOperator.GreaterOrEqual,
			value: 8,},
		{
			thingType: ThingType.Thing.Research,
			specificThingType: GameType.ResearchType.ImpulseDrive,
			condition: RequirementValueGetters.RESEARCH_LEVEL,
			operator: RequirementType.RequirementOperator.GreaterOrEqual,
			value: 6,},
		{
			thingType: ThingType.Thing.Research,
			specificThingType: GameType.ResearchType.PlasmaTech,
			condition: RequirementValueGetters.RESEARCH_LEVEL,
			operator: RequirementType.RequirementOperator.GreaterOrEqual,
			value: 5,},],
		costMap: new Map<GameType.ResourceType, number>([
			[GameType.ResourceType.Metal, 50000],
			[GameType.ResourceType.Crystal, 25000],
			[GameType.ResourceType.Deuterium, 15000],]),
		maxHealth: 75000,
		shieldPower: 500,
		weaponPower: 1000,
		rapidFire: new Map<GameType.UnitType, number>([
			[GameType.UnitType.EspionageProbe, 5],
			[GameType.UnitType.SolarSatellite, 5],
			[GameType.UnitType.RocketLauncher, 20],
			[GameType.UnitType.LightLaser, 20],
			[GameType.UnitType.HeavyLaser, 10],
			[GameType.UnitType.IonCannon, 10],
			[GameType.UnitType.GaussCannon, 5],
			[GameType.UnitType.PlasmaTurret, 5],]),
		space: 500,
		speed: {
			speedFunctionType: GameType.SpeedFunctionType.EngineDrive,
			engineTechData: [
				{ engineTech: GameType.ResearchType.ImpulseDrive, researchLevel: 0, value: 4000},
				{ engineTech: GameType.ResearchType.HyperspaceDrive, researchLevel: 8, value: 5000}]},
		baseFuelConsumption: [
			{ engineTech: GameType.ResearchType.ImpulseDrive, researchLevel: 0, value: new Map<GameType.ResourceType, number>([[GameType.ResourceType.Deuterium, 700]])},],
	}],

	[GameType.UnitType.Destroyer, { displayName: "Destroyer",
		canGenerateDebris: true,
		canBeRepairedAtRepairDock: true,
		participatesInCombat: true,
		category: GameType.UnitCategory.Ship,
		queueType: GameType.UnitConstructionQueueType.Shipyard,
		requirements:[
		{
			thingType: ThingType.Thing.Building,
			specificThingType: GameType.BuildingType.Shipyard,
			condition: RequirementValueGetters.BUILDING_LEVEL,
			operator: RequirementType.RequirementOperator.GreaterOrEqual,
			value: 9,},
		{
			thingType: ThingType.Thing.Research,
			specificThingType: GameType.ResearchType.HyperspaceDrive,
			condition: RequirementValueGetters.RESEARCH_LEVEL,
			operator: RequirementType.RequirementOperator.GreaterOrEqual,
			value: 6,},
		{
			thingType: ThingType.Thing.Research,
			specificThingType: GameType.ResearchType.HyperspaceTech,
			condition: RequirementValueGetters.RESEARCH_LEVEL,
			operator: RequirementType.RequirementOperator.GreaterOrEqual,
			value: 5,},],
		costMap: new Map<GameType.ResourceType, number>([
			[GameType.ResourceType.Metal, 60000],
			[GameType.ResourceType.Crystal, 50000],
			[GameType.ResourceType.Deuterium, 15000],]),
		maxHealth: 110000,
		shieldPower: 500,
		weaponPower: 2000,
		rapidFire: new Map<GameType.UnitType, number>([
			[GameType.UnitType.EspionageProbe, 5],
			[GameType.UnitType.SolarSatellite, 5],
			[GameType.UnitType.LightLaser, 10],
			[GameType.UnitType.Battlecruiser, 2],]),
		space: 2000,
		speed: {
			speedFunctionType: GameType.SpeedFunctionType.EngineDrive,
			engineTechData: [
				{ engineTech: GameType.ResearchType.HyperspaceDrive, researchLevel: 0, value: 5000}]},
		baseFuelConsumption: [
			{ engineTech: GameType.ResearchType.HyperspaceDrive, researchLevel: 0, value: new Map<GameType.ResourceType, number>([[GameType.ResourceType.Deuterium, 1000]])},],
	}],

	[GameType.UnitType.Deathstar, { displayName: "Death Star",
		canGenerateDebris: true,
		canBeRepairedAtRepairDock: true,
		participatesInCombat: true,
		participatesInMoonDestruction: true,
		category: GameType.UnitCategory.Ship,
		queueType: GameType.UnitConstructionQueueType.Shipyard,
		requirements:[
		{
			thingType: ThingType.Thing.Building,
			specificThingType: GameType.BuildingType.Shipyard,
			condition: RequirementValueGetters.BUILDING_LEVEL,
			operator: RequirementType.RequirementOperator.GreaterOrEqual,
			value: 12,},
		{
			thingType: ThingType.Thing.Research,
			specificThingType: GameType.ResearchType.HyperspaceDrive,
			condition: RequirementValueGetters.RESEARCH_LEVEL,
			operator: RequirementType.RequirementOperator.GreaterOrEqual,
			value: 7,},
		{
			thingType: ThingType.Thing.Research,
			specificThingType: GameType.ResearchType.HyperspaceTech,
			condition: RequirementValueGetters.RESEARCH_LEVEL,
			operator: RequirementType.RequirementOperator.GreaterOrEqual,
			value: 6,},
		{
			thingType: ThingType.Thing.Research,
			specificThingType: GameType.ResearchType.GravitonTech,
			condition: RequirementValueGetters.RESEARCH_LEVEL,
			operator: RequirementType.RequirementOperator.GreaterOrEqual,
			value: 1,},],
		costMap: new Map<GameType.ResourceType, number>([
			[GameType.ResourceType.Metal, 5000000],
			[GameType.ResourceType.Crystal, 4000000],
			[GameType.ResourceType.Deuterium, 1000000],]),
		maxHealth: 9000000,
		shieldPower: 50000,
		weaponPower: 200000,
		rapidFire: new Map<GameType.UnitType, number>([
			[GameType.UnitType.EspionageProbe, 1250],
			[GameType.UnitType.SolarSatellite, 1250],
			[GameType.UnitType.SmallTransport, 250],
			[GameType.UnitType.LargeTransport, 250],
			[GameType.UnitType.ColonyShip, 250],
			[GameType.UnitType.Recycler, 250],
			[GameType.UnitType.RocketLauncher, 200],
			[GameType.UnitType.LightFighter, 200],
			[GameType.UnitType.HeavyFighter, 100],
			[GameType.UnitType.Cruiser, 33],
			[GameType.UnitType.Battleship, 30],
			[GameType.UnitType.Battlecruiser, 15],
			[GameType.UnitType.Bomber, 25],
			[GameType.UnitType.Destroyer, 5],
			[GameType.UnitType.LightLaser, 200],
			[GameType.UnitType.HeavyLaser, 100],
			[GameType.UnitType.IonCannon, 100],
			[GameType.UnitType.GaussCannon, 50],]),
		space: 1000000,
		speed: {
			speedFunctionType: GameType.SpeedFunctionType.EngineDrive,
			engineTechData: [
				{ engineTech: GameType.ResearchType.HyperspaceDrive, researchLevel: 0, value: 100}]},
		baseFuelConsumption: [
			{ engineTech: GameType.ResearchType.HyperspaceDrive, researchLevel: 0, value: new Map<GameType.ResourceType, number>([[GameType.ResourceType.Deuterium, 1]])},],
	}],
	[GameType.UnitType.RocketLauncher, { displayName: "Rocket Launcher",
		category: GameType.UnitCategory.Defense,
		queueType: GameType.UnitConstructionQueueType.Shipyard,
		requirements:[
		{
			thingType: ThingType.Thing.Building,
			specificThingType: GameType.BuildingType.Shipyard,
			condition: RequirementValueGetters.BUILDING_LEVEL,
			operator: RequirementType.RequirementOperator.GreaterOrEqual,
			value: 1,},],
		costMap: new Map<GameType.ResourceType, number>([
			[GameType.ResourceType.Metal, 2000],]),
		maxHealth: 2000,
		shieldPower: 20,
		weaponPower: 80,
		repairChance: 0.7,
		participatesInCombat: true,
	}],

	[GameType.UnitType.LightLaser, { displayName: "Light Laser",
		category: GameType.UnitCategory.Defense,
		queueType: GameType.UnitConstructionQueueType.Shipyard,
		requirements:[
		{
			thingType: ThingType.Thing.Building,
			specificThingType: GameType.BuildingType.Shipyard,
			condition: RequirementValueGetters.BUILDING_LEVEL,
			operator: RequirementType.RequirementOperator.GreaterOrEqual,
			value: 2,},
		{
			thingType: ThingType.Thing.Research,
			specificThingType: GameType.ResearchType.EnergyTech,
			condition: RequirementValueGetters.RESEARCH_LEVEL,
			operator: RequirementType.RequirementOperator.GreaterOrEqual,
			value: 1,},
		{
			thingType: ThingType.Thing.Research,
			specificThingType: GameType.ResearchType.LaserTech,
			condition: RequirementValueGetters.RESEARCH_LEVEL,
			operator: RequirementType.RequirementOperator.GreaterOrEqual,
			value: 3,},],
		costMap: new Map<GameType.ResourceType, number>([
			[GameType.ResourceType.Metal, 1500],
			[GameType.ResourceType.Crystal, 500],]),
		maxHealth: 2000,
		shieldPower: 25,
		weaponPower: 100,
		repairChance: 0.7,
		participatesInCombat: true,
	}],

	[GameType.UnitType.HeavyLaser, { displayName: "Heavy Laser",
		category: GameType.UnitCategory.Defense,
		queueType: GameType.UnitConstructionQueueType.Shipyard,
		requirements:[
		{
			thingType: ThingType.Thing.Building,
			specificThingType: GameType.BuildingType.Shipyard,
			condition: RequirementValueGetters.BUILDING_LEVEL,
			operator: RequirementType.RequirementOperator.GreaterOrEqual,
			value: 4,},
		{
			thingType: ThingType.Thing.Research,
			specificThingType: GameType.ResearchType.EnergyTech,
			condition: RequirementValueGetters.RESEARCH_LEVEL,
			operator: RequirementType.RequirementOperator.GreaterOrEqual,
			value: 3,},
		{
			thingType: ThingType.Thing.Research,
			specificThingType: GameType.ResearchType.LaserTech,
			condition: RequirementValueGetters.RESEARCH_LEVEL,
			operator: RequirementType.RequirementOperator.GreaterOrEqual,
			value: 6,},],
		costMap: new Map<GameType.ResourceType, number>([
			[GameType.ResourceType.Metal, 6000],
			[GameType.ResourceType.Crystal, 2000],]),
		maxHealth: 8000,
		shieldPower: 100,
		weaponPower: 250,
		repairChance: 0.7,
		participatesInCombat: true,
	}],

	[GameType.UnitType.IonCannon, { displayName: "Ion Cannon",
		category: GameType.UnitCategory.Defense,
		queueType: GameType.UnitConstructionQueueType.Shipyard,
		requirements:[
		{
			thingType: ThingType.Thing.Building,
			specificThingType: GameType.BuildingType.Shipyard,
			condition: RequirementValueGetters.BUILDING_LEVEL,
			operator: RequirementType.RequirementOperator.GreaterOrEqual,
			value: 4,},
		{
			thingType: ThingType.Thing.Research,
			specificThingType: GameType.ResearchType.IonTech,
			condition: RequirementValueGetters.RESEARCH_LEVEL,
			operator: RequirementType.RequirementOperator.GreaterOrEqual,
			value: 4,},],
		costMap: new Map<GameType.ResourceType, number>([
			[GameType.ResourceType.Metal, 5000],
			[GameType.ResourceType.Crystal, 3000],]),
		maxHealth: 8000,
		shieldPower: 500,
		weaponPower: 150,
		repairChance: 0.7,
		participatesInCombat: true,
	}],

	[GameType.UnitType.GaussCannon, { displayName: "Gauss Cannon",
		category: GameType.UnitCategory.Defense,
		queueType: GameType.UnitConstructionQueueType.Shipyard,
		requirements:[
		{
			thingType: ThingType.Thing.Building,
			specificThingType: GameType.BuildingType.Shipyard,
			condition: RequirementValueGetters.BUILDING_LEVEL,
			operator: RequirementType.RequirementOperator.GreaterOrEqual,
			value: 6,},
		{
			thingType: ThingType.Thing.Research,
			specificThingType: GameType.ResearchType.EnergyTech,
			condition: RequirementValueGetters.RESEARCH_LEVEL,
			operator: RequirementType.RequirementOperator.GreaterOrEqual,
			value: 6,},
		{
			thingType: ThingType.Thing.Research,
			specificThingType: GameType.ResearchType.WeaponTech,
			condition: RequirementValueGetters.RESEARCH_LEVEL,
			operator: RequirementType.RequirementOperator.GreaterOrEqual,
			value: 3,},
		{
			thingType: ThingType.Thing.Research,
			specificThingType: GameType.ResearchType.ShieldingTech,
			condition: RequirementValueGetters.RESEARCH_LEVEL,
			operator: RequirementType.RequirementOperator.GreaterOrEqual,
			value: 1,},],
		costMap: new Map<GameType.ResourceType, number>([
			[GameType.ResourceType.Metal, 20000],
			[GameType.ResourceType.Crystal, 15000],
			[GameType.ResourceType.Deuterium, 2000],]),
		maxHealth: 35000,
		shieldPower: 200,
		weaponPower: 1100,
		repairChance: 0.7,
		participatesInCombat: true,
	}],

	[GameType.UnitType.PlasmaTurret, { displayName: "Plasma Turret",
		category: GameType.UnitCategory.Defense,
		queueType: GameType.UnitConstructionQueueType.Shipyard,
		requirements:[
		{
			thingType: ThingType.Thing.Building,
			specificThingType: GameType.BuildingType.Shipyard,
			condition: RequirementValueGetters.BUILDING_LEVEL,
			operator: RequirementType.RequirementOperator.GreaterOrEqual,
			value: 8,},
		{
			thingType: ThingType.Thing.Research,
			specificThingType: GameType.ResearchType.PlasmaTech,
			condition: RequirementValueGetters.RESEARCH_LEVEL,
			operator: RequirementType.RequirementOperator.GreaterOrEqual,
			value: 7,},],
		costMap: new Map<GameType.ResourceType, number>([
			[GameType.ResourceType.Metal, 50000],
			[GameType.ResourceType.Crystal, 50000],
			[GameType.ResourceType.Deuterium, 30000],]),
		maxHealth: 100000,
		shieldPower: 300,
		weaponPower: 3000,
		repairChance: 0.7,
		participatesInCombat: true,
	}],

	[GameType.UnitType.SmallShieldDome, { displayName: "Small Shield Dome",
		category: GameType.UnitCategory.Defense,
		queueType: GameType.UnitConstructionQueueType.Shipyard,
		requirements:[
		{
			thingType: ThingType.Thing.Building,
			specificThingType: GameType.BuildingType.Shipyard,
			condition: RequirementValueGetters.BUILDING_LEVEL,
			operator: RequirementType.RequirementOperator.GreaterOrEqual,
			value: 1,},
		{
			thingType: ThingType.Thing.Research,
			specificThingType: GameType.ResearchType.ShieldingTech,
			condition: RequirementValueGetters.RESEARCH_LEVEL,
			operator: RequirementType.RequirementOperator.GreaterOrEqual,
			value: 2,},
		{
			thingType: ThingType.Thing.Unit,
			specificThingType: GameType.UnitType.SmallShieldDome,
			condition: RequirementValueGetters.OWNED_AND_QUEUED_UNIT_COUNT,
			operator: RequirementType.RequirementOperator.LesserThan,
			value: 1,},],
		costMap: new Map<GameType.ResourceType, number>([
			[GameType.ResourceType.Metal, 10000],
			[GameType.ResourceType.Crystal, 10000],]),
		maxHealth: 20000,
		shieldPower: 2000,
		weaponPower: 1,
		repairChance: 0.7,
		participatesInCombat: true,
	}],

	[GameType.UnitType.LargeShieldDome, { displayName: "Large Shield Dome",
		category: GameType.UnitCategory.Defense,
		queueType: GameType.UnitConstructionQueueType.Shipyard,
		requirements:[
		{
			thingType: ThingType.Thing.Building,
			specificThingType: GameType.BuildingType.Shipyard,
			condition: RequirementValueGetters.BUILDING_LEVEL,
			operator: RequirementType.RequirementOperator.GreaterOrEqual,
			value: 6,},
		{
			thingType: ThingType.Thing.Research,
			specificThingType: GameType.ResearchType.ShieldingTech,
			condition: RequirementValueGetters.RESEARCH_LEVEL,
			operator: RequirementType.RequirementOperator.GreaterOrEqual,
			value: 6,},
		{
			thingType: ThingType.Thing.Unit,
			specificThingType: GameType.UnitType.LargeShieldDome,
			condition: RequirementValueGetters.OWNED_AND_QUEUED_UNIT_COUNT,
			operator: RequirementType.RequirementOperator.LesserThan,
			value: 1,},],
		costMap: new Map<GameType.ResourceType, number>([
			[GameType.ResourceType.Metal, 50000],
			[GameType.ResourceType.Crystal, 50000],]),
		maxHealth: 100000,
		shieldPower: 10000,
		weaponPower: 1,
		repairChance: 0.7,
		participatesInCombat: true,
	}],

	[GameType.UnitType.SolarSatellite, { displayName: "Solar Satellite",
		participatesInCombat: true,
		category: GameType.UnitCategory.Satellite,
		queueType: GameType.UnitConstructionQueueType.Shipyard,
		requirements:[
		{
			thingType: ThingType.Thing.Building,
			specificThingType: GameType.BuildingType.Shipyard,
			condition: RequirementValueGetters.BUILDING_LEVEL,
			operator: RequirementType.RequirementOperator.GreaterOrEqual,
			value: 1,},],
		costMap: new Map<GameType.ResourceType, number>([
			[GameType.ResourceType.Crystal, 2000],
			[GameType.ResourceType.Deuterium, 500],]),
		maxHealth: 2000,
		shieldPower: 1,
		weaponPower: 1,
		planetValueStats: [
			{planetValueProductionFormulasType:
				GameType.PlanetValueProductionFormulasType.TemperatureScaled,
				planetValueType: GameType.PlanetValueType.Energy,
				basePlanetValueFactor: 1,
				temperatureOffset: 160,
				temperatureDivider: 6,}],
	}],

	[GameType.UnitType.InterplanetaryMissile, { displayName: "Interplanetary Missile",
		category: GameType.UnitCategory.Missile,
		canLaunchAsMissile: true,
		speed: {
			speedFunctionType: GameType.SpeedFunctionType.Missile,
			rangeFunctionType: GameType.RangeFunctionType.Missile,},
		space: 0,
		queueType: GameType.UnitConstructionQueueType.MissileSilo,
		requirements:[
		{
			thingType: ThingType.Thing.Building,
			specificThingType: GameType.BuildingType.MissileSilo,
			condition: RequirementValueGetters.BUILDING_LEVEL,
			operator: RequirementType.RequirementOperator.GreaterOrEqual,
			value: 4,},
		{
			thingType: ThingType.Thing.Research,
			specificThingType: GameType.ResearchType.ImpulseDrive,
			condition: RequirementValueGetters.RESEARCH_LEVEL,
			operator: RequirementType.RequirementOperator.GreaterOrEqual,
			value: 1,},
		{
			thingType: ThingType.Thing.PlanetValue,
			specificThingType: GameType.PlanetValueType.MissileSpace,
			condition: RequirementValueGetters.FREE_MISSILE_SPACE,
			operator: RequirementType.RequirementOperator.GreaterThan,
			value: 0,},],
		costMap: new Map<GameType.ResourceType, number>([
			[GameType.ResourceType.Metal, 12500],
			[GameType.ResourceType.Crystal, 2500],
			[GameType.ResourceType.Deuterium, 10000],]),
		maxHealth: 15000,
		shieldPower: 1,
		weaponPower: 12000,
		planetValueStats: [
			{planetValueProductionFormulasType:
				GameType.PlanetValueProductionFormulasType.FixedPerUnit,
				planetValueType: GameType.PlanetValueType.MissileSpace,
				basePlanetValueFactor: -2,}],
	}],

	[GameType.UnitType.InterceptorMissile, { displayName: "Interceptor Missile",
		category: GameType.UnitCategory.Missile,
		queueType: GameType.UnitConstructionQueueType.MissileSilo,
		requirements:[
		{
			thingType: ThingType.Thing.Building,
			specificThingType: GameType.BuildingType.MissileSilo,
			condition: RequirementValueGetters.BUILDING_LEVEL,
			operator: RequirementType.RequirementOperator.GreaterOrEqual,
			value: 2,},
		{
			thingType: ThingType.Thing.PlanetValue,
			specificThingType: GameType.PlanetValueType.MissileSpace,
			condition: RequirementValueGetters.FREE_MISSILE_SPACE,
			operator: RequirementType.RequirementOperator.GreaterThan,
			value: 0,},],
		costMap: new Map<GameType.ResourceType, number>([
			[GameType.ResourceType.Metal, 8000],
			[GameType.ResourceType.Deuterium, 2000],]),
		maxHealth: 8000,
		shieldPower: 1,
		weaponPower: 1,
		planetValueStats: [
			{planetValueProductionFormulasType:
				GameType.PlanetValueProductionFormulasType.FixedPerUnit,
				planetValueType: GameType.PlanetValueType.MissileSpace,
				basePlanetValueFactor: -1,}],
	}],
]);

export const UNIT_CATEGORY_INFOS: ReadonlyMap<GameType.UnitCategory, GameType.UnitCategoryInfo> = new Map<GameType.UnitCategory, GameType.UnitCategoryInfo>
([
	[GameType.UnitCategory.Ship, {
		displayName: "Ships",}],
	[GameType.UnitCategory.Defense, {
		displayName: "Defenses",}],
	[GameType.UnitCategory.Satellite, {
		displayName: "Satellites",}],
	[GameType.UnitCategory.Missile, {
		displayName: "Missiles",}],
]);
//#endregion

//#region Resource
export const RESOURCE_INFOS: ReadonlyMap<GameType.ResourceType, GameType.ResourceInfo> = new Map<GameType.ResourceType, GameType.ResourceInfo>
([
    [GameType.ResourceType.Metal, {
		displayName: "Metal",
		countsInUnitValue: true,
		countsTowardConstructionTime: true,
		countsTowardResearchTime: true,}],
	[GameType.ResourceType.Crystal, {
		displayName: "Crystal",
		countsInUnitValue: true,
		countsTowardConstructionTime: true,
		countsTowardResearchTime: true,}],
	[GameType.ResourceType.Deuterium, {
		displayName: "Deuterium",
		countsInUnitValue: false,}],
]);
//#endregion

//#region Fleet
const HAS_FREE_FLEET_SLOT_REQUIREMENT: RequirementType.Requirement =
{
	condition: RequirementValueGetters.HAS_FREE_FLEET_SLOT,
	operator: RequirementType.RequirementOperator.Equal,
	value: true,
};

export const FLEET_ACTION_INFOS: ReadonlyMap<GameType.FleetActionType, GameType.FleetActionInfo> = new Map<GameType.FleetActionType, GameType.FleetActionInfo>
([
    [GameType.FleetActionType.Station, {
		displayName: "Station",
			category: GameType.FleetActionCategory.Ship,
			requirements:[
				HAS_FREE_FLEET_SLOT_REQUIREMENT,
			{
				condition: RequirementValueGetters.DOES_TARGET_ZONE_EXIST,
				operator: RequirementType.RequirementOperator.Equal,
				value: true,},
			{
				condition: RequirementValueGetters.CAN_TARGET_PLAYER_BY_SCORE,
				operator: RequirementType.RequirementOperator.Equal,
				value: true,},],}],

	[GameType.FleetActionType.Collect, {
		displayName: "Collect",
			category: GameType.FleetActionCategory.Ship,
			returnsToOrigin: true,
			requirements:[
				HAS_FREE_FLEET_SLOT_REQUIREMENT,
			{
				condition: RequirementValueGetters.DOES_TARGET_ZONE_EXIST,
				operator: RequirementType.RequirementOperator.Equal,
				value: true,},
			{
				condition: RequirementValueGetters.CAN_TARGET_PLAYER_BY_SCORE,
				operator: RequirementType.RequirementOperator.Equal,
				value: true,},],}],

	[GameType.FleetActionType.Transport, {
		displayName: "Transport",
			category: GameType.FleetActionCategory.Ship,
			returnsToOrigin: true,
			requirements:[
				HAS_FREE_FLEET_SLOT_REQUIREMENT,
			{
				condition: RequirementValueGetters.DOES_TARGET_ZONE_EXIST,
				operator: RequirementType.RequirementOperator.Equal,
				value: true,},
			{
				condition: RequirementValueGetters.TRANSPORTED_RESOURCE_TOTAL,
				operator: RequirementType.RequirementOperator.GreaterThan,
				value: 0,},],}],

	[GameType.FleetActionType.Colonize, {
		displayName: "Colonize",
			category: GameType.FleetActionCategory.Ship,
			requirements:[
				HAS_FREE_FLEET_SLOT_REQUIREMENT,
			{
				condition: RequirementValueGetters.FLEET_HAS_COLONIZE_UNIT,
				operator: RequirementType.RequirementOperator.Equal,
				value: true,},
			{
				condition: RequirementValueGetters.IS_ZONE_ASSOCIATED_PLANET_OWNED,
				operator: RequirementType.RequirementOperator.Equal,
				value: false,},
			{
				condition: RequirementValueGetters.GET_TARGET_PLANET_ZONE,
				operator: RequirementType.RequirementOperator.Equal,
				value: GameType.PlanetZone.Planet,},
			{
				condition: RequirementValueGetters.FREE_COLONY_PLANET_SLOTS,
				operator: RequirementType.RequirementOperator.GreaterThan,
				value: 0,},],}],

	[GameType.FleetActionType.Recycle, {
		displayName: "Recycle",
			category: GameType.FleetActionCategory.Ship,
			returnsToOrigin: true,
			requirements:[
				HAS_FREE_FLEET_SLOT_REQUIREMENT,
			{
				condition: RequirementValueGetters.GET_TARGET_PLANET_ZONE,
				operator: RequirementType.RequirementOperator.Equal,
				value: GameType.PlanetZone.DebrisField,},
			{
				condition: RequirementValueGetters.ALL_FLEET_UNITS_CAN_TARGET_DEBRIS_FIELD,
				operator: RequirementType.RequirementOperator.Equal,
				value: true,},
			{
				condition: RequirementValueGetters.IS_ZONE_ASSOCIATED_PLANET_OWNED,
				operator: RequirementType.RequirementOperator.Equal,
				value: true,},],}],
				
	[GameType.FleetActionType.Espionage, {
		displayName: "Espionage",
			category: GameType.FleetActionCategory.Ship,
			returnsToOrigin: true,
			requirements:[
				HAS_FREE_FLEET_SLOT_REQUIREMENT,
			{
				condition: RequirementValueGetters.DOES_TARGET_ZONE_EXIST,
				operator: RequirementType.RequirementOperator.Equal,
				value: true,},
			{
				condition: RequirementValueGetters.ALL_FLEET_UNITS_CAN_SPY,
				operator: RequirementType.RequirementOperator.Equal,
				value: true,},
			{
				condition: RequirementValueGetters.IS_TARGET_PLANET_ZONE_SPYABLE,
				operator: RequirementType.RequirementOperator.Equal,
				value: true,},
			{
				condition: RequirementValueGetters.CAN_TARGET_PLAYER_BY_SCORE,
				operator: RequirementType.RequirementOperator.Equal,
				value: true,},],}],

	[GameType.FleetActionType.MissileLaunch, {
		displayName: "Missile Launch",
			category: GameType.FleetActionCategory.Missile,
			canBeScanned: false,
			canBeRecalled: false,
			requirements:[
			{
				condition: RequirementValueGetters.DOES_TARGET_ZONE_EXIST,
				operator: RequirementType.RequirementOperator.Equal,
				value: true,},
			{
				condition: RequirementValueGetters.IS_TARGET_ENEMY_OWNED,
				operator: RequirementType.RequirementOperator.Equal,
				value: true,},
			{
				condition: RequirementValueGetters.IS_TARGET_WITHIN_RANGE,
				operator: RequirementType.RequirementOperator.Equal,
				value: true,},
			{
				condition: RequirementValueGetters.ALL_FLEET_UNITS_ARE_LAUNCHABLE_MISSILES,
				operator: RequirementType.RequirementOperator.Equal,
				value: true,},
			{
				condition: RequirementValueGetters.CAN_TARGET_PLAYER_BY_SCORE,
				operator: RequirementType.RequirementOperator.Equal,
				value: true,},],}],

	[GameType.FleetActionType.Attack, {
		displayName: "Attack",
			category: GameType.FleetActionCategory.Ship,
			returnsToOrigin: true,
			requirements:[
				HAS_FREE_FLEET_SLOT_REQUIREMENT,
			{
				condition: RequirementValueGetters.DOES_TARGET_ZONE_EXIST,
				operator: RequirementType.RequirementOperator.Equal,
				value: true,},
			{
				condition: RequirementValueGetters.IS_TARGET_ENEMY_OWNED,
				operator: RequirementType.RequirementOperator.Equal,
				value: true,},
			{
				condition: RequirementValueGetters.IS_TARGET_PLANET_ZONE_ATTACKABLE,
				operator: RequirementType.RequirementOperator.Equal,
				value: true,},
			{
				condition: RequirementValueGetters.CAN_TARGET_PLAYER_BY_SCORE,
				operator: RequirementType.RequirementOperator.Equal,
				value: true,},],}],

	[GameType.FleetActionType.DestroyMoon, {
		displayName: "Destroy Moon",
			category: GameType.FleetActionCategory.Ship,
			returnsToOrigin: true,
			requirements:[
				HAS_FREE_FLEET_SLOT_REQUIREMENT,
			{
				condition: RequirementValueGetters.DOES_TARGET_ZONE_EXIST,
				operator: RequirementType.RequirementOperator.Equal,
				value: true,},
			{
				condition: RequirementValueGetters.GET_TARGET_PLANET_ZONE,
				operator: RequirementType.RequirementOperator.Equal,
				value: GameType.PlanetZone.Moon,},
			{
				condition: RequirementValueGetters.IS_TARGET_ENEMY_OWNED,
				operator: RequirementType.RequirementOperator.Equal,
				value: true,},
			{
				condition: RequirementValueGetters.FLEET_HAS_MOON_DESTRUCTION_UNIT,
				operator: RequirementType.RequirementOperator.Equal,
				value: true,},
			{
				condition: RequirementValueGetters.CAN_TARGET_PLAYER_BY_SCORE,
				operator: RequirementType.RequirementOperator.Equal,
				value: true,},],}],
]);
//#endregion

//#region PlanetValue
export const PLANET_VALUE_INFOS: ReadonlyMap<GameType.PlanetValueType, GameType.PlanetValueInfo> = new Map<GameType.PlanetValueType, GameType.PlanetValueInfo>
([
    [GameType.PlanetValueType.Energy, {
		displayName: "Energy",
		showInTopBar: true,
		ratioImpactsResourceProduction: true}],
	[GameType.PlanetValueType.MetalStorage, {
		displayName: "Metal Storage",
		showInTopBar: false,
		associatedResource: GameType.ResourceType.Metal,
		limitsResourceMax: true,}],
	[GameType.PlanetValueType.CrystalStorage, {
		displayName: "Crystal Storage",
		showInTopBar: false,
		associatedResource: GameType.ResourceType.Crystal,
		limitsResourceMax: true,}],
	[GameType.PlanetValueType.DeuteriumStorage, {
		displayName: "Deuterium Storage",
		showInTopBar: false,
		associatedResource: GameType.ResourceType.Deuterium,
		limitsResourceMax: true,}],
	[GameType.PlanetValueType.Size, {
		displayName: "Size",
		showInTopBar: false,}],
	[GameType.PlanetValueType.Temperature, {
		displayName: "Temperature",
		showInTopBar: false,}],
	[GameType.PlanetValueType.MissileSpace, {
		displayName: "Missile Space",
		showInTopBar: false,}],
]);
//#endregion

//#region PlayerValue
export const PLAYER_VALUE_INFOS: ReadonlyMap<GameType.PlayerValueType, GameType.PlayerValueInfo> = new Map<GameType.PlayerValueType, GameType.PlayerValueInfo>
([
    [GameType.PlayerValueType.FleetSlots, {
		displayName: "Fleet Slots",}],
	[GameType.PlayerValueType.FleetSpaceModificationPercent, {
		displayName: "Fleet Space Modification",}],
	[GameType.PlayerValueType.MetalProductionModificationPercent, {
		displayName: "Metal Production Modification",
		modifiesResourceProduction: true,
		associatedResource: GameType.ResourceType.Metal,}],
	[GameType.PlayerValueType.CrystalProductionModificationPercent, {
		displayName: "Crystal Production Modification",
		modifiesResourceProduction: true,
		associatedResource: GameType.ResourceType.Crystal,}],
	[GameType.PlayerValueType.DeuteriumProductionModificationPercent, {
		displayName: "Deuterium Production Modification",
		modifiesResourceProduction: true,
		associatedResource: GameType.ResourceType.Deuterium,}],
	[GameType.PlayerValueType.DeconstructionCostModificationPercent, {
		displayName: "Deconstruction Cost Modification",}],
	[GameType.PlayerValueType.ColonySlots, {
		displayName: "Colony Slots",}],
]);
//#endregion

//#region Planet
export const PLANET_ZONE_INFOS: ReadonlyMap<GameType.PlanetZone, GameType.PlanetZoneInfo> = new Map<GameType.PlanetZone, GameType.PlanetZoneInfo>
([
    [GameType.PlanetZone.Planet, {
		displayName: "Planet",
		isSelectable: true,
		canProduceResources: true,
		canBeSpied: true,
			canBeAttacked: true,}],
	[GameType.PlanetZone.Moon, {
		displayName: "Moon",
		isSelectable: true,
		canProduceResources: false,
		canBeSpied: true,
			canBeAttacked: true,}],
	[GameType.PlanetZone.DebrisField, {
		displayName: "Debris Field",
		isSelectable: false,
		canProduceResources: false,
		canBeSpied: false,
			canBeAttacked: false,}],
]);

export const STARTING_PLANET_DATA: CoreType.DynamicPlanetData =
{
	...structuredClone(CoreType.EmptyPlanetData),
	resourceQuantity: new Map<GameType.ResourceType, number>
	([
		[GameType.ResourceType.Metal, 2000],
		[GameType.ResourceType.Crystal, 500],
		[GameType.ResourceType.Deuterium, 0],
	]),
} as const;

export const SLOT_SIZE_RANGES: GameType.SlotSizeRange[] =
[
    { min: 40,  max: 70  },  // slot 1
    { min: 120, max: 310 },  // slot 2
    { min: 125, max: 255 },  // slot 3
    { min: 75,  max: 125 },  // slot 4
    { min: 60,  max: 90  },  // slot 5
];

export const KELVIN_OFFSET: number = 273;

// Kelvins
export const SLOT_TEMPERATURE_RANGES: GameType.SlotTemperatureRange[] =
[
    { min: 393, max: 533 },  // slot 1
    { min: 323, max: 383 },  // slot 2
    { min: 293, max: 353 },  // slot 3
    { min: 263, max: 323 },  // slot 4
    { min: 143, max: 283 },  // slot 5
];

export const DEUTERIUM_TEMPERATURE_COEFF: number = -0.004;
export const DEUTERIUM_TEMPERATURE_BASE: number = 1.36 - DEUTERIUM_TEMPERATURE_COEFF * KELVIN_OFFSET;
export const GALAXY_DISTANCE: number = 20000;
export const SYSTEM_DISTANCE: number = 2700;
export const SYSTEM_DISTANCE_FACTOR: number = 95;
export const SLOT_DISTANCE: number = 1000;
export const SLOT_DISTANCE_FACTOR: number = 5;
export const PLANET_TO_MOON_DISTANCE: number = 5;

export const GALAXY_COUNT: number = 2;

export const SYSTEM_COUNT: number = 20;
export const SLOT_COUNT: number = 5;
export const MIN_SLOT_STARTING_PLANET: number = 3;
export const MAX_SLOT_STARTING_PLANET: number = 4;
export const STARTING_PLANET_SIZE: number = 163;
export const STARTING_MOON_SIZE: number = 1;
export const STARTING_OWNED_PLANET_COUNT: number = 2;
export const MAX_PLANET_NAME_LENGTH: number = 16;
//#endregion

//#region Requirements
export const GLOBAL_REQUIREMENTS: Map<ThingType.Thing, RequirementType.Requirement[]> = new Map<ThingType.Thing, RequirementType.Requirement[]>
([
    [ThingType.Thing.BuildingUpgrade, [
	{
		hideDataWhenRequirementFailed: false,
		condition: RequirementValueGetters.IS_ANY_BUILDING_UPGRADE_IN_PROGRESS,
		operator: RequirementType.RequirementOperator.Equal,
		value: false,},
	{
		hideDataWhenRequirementFailed: false,
		condition: RequirementValueGetters.IS_ANY_BUILDING_DECONSTRUCTION_IN_PROGRESS,
		operator: RequirementType.RequirementOperator.Equal,
		value: false,}]],
	[ThingType.Thing.BuildingDeconstruction, [
	{
		hideDataWhenRequirementFailed: false,
		condition: RequirementValueGetters.IS_ANY_BUILDING_UPGRADE_IN_PROGRESS,
		operator: RequirementType.RequirementOperator.Equal,
		value: false,},
	{
		hideDataWhenRequirementFailed: false,
		condition: RequirementValueGetters.IS_ANY_BUILDING_DECONSTRUCTION_IN_PROGRESS,
		operator: RequirementType.RequirementOperator.Equal,
		value: false,}]],
	[ThingType.Thing.ResearchingResearch, [
	{
		hideDataWhenRequirementFailed: false,
		condition: RequirementValueGetters.IS_ANY_RESEARCH_IN_PROGRESS,
		operator: RequirementType.RequirementOperator.Equal,
		value: false,},
	{
		hideDataWhenRequirementFailed: false,
		thingType: ThingType.Thing.BuildingUpgrade,
		specificThingType: GameType.BuildingType.ResearchLab,
		condition: RequirementValueGetters.IS_SPECIFIC_BUILDING_BEING_UPGRADED,
		operator: RequirementType.RequirementOperator.Equal,
		value: false,},
	{
		hideDataWhenRequirementFailed: false,
		thingType: ThingType.Thing.BuildingDeconstruction,
		specificThingType: GameType.BuildingType.ResearchLab,
		condition: RequirementValueGetters.IS_SPECIFIC_BUILDING_BEING_DECONSTRUCTED,
		operator: RequirementType.RequirementOperator.Equal,
		value: false,},
	{
		hideDataWhenRequirementFailed: false,
		thingType: ThingType.Thing.Building,
		specificThingType: GameType.BuildingType.ResearchLab,
		condition: RequirementValueGetters.BUILDING_LEVEL,
		operator: RequirementType.RequirementOperator.GreaterOrEqual,
		value: 1,}]],
		[ThingType.Thing.UnitConstruction, [
		{
			thingType: ThingType.Thing.BuildingUpgrade,
			specificThingType: GameType.BuildingType.Shipyard,
			condition: RequirementValueGetters.IS_SPECIFIC_BUILDING_BEING_UPGRADED,
			operator: RequirementType.RequirementOperator.Equal,
			value: false,},
	{
		thingType: ThingType.Thing.BuildingUpgrade,
		specificThingType: GameType.BuildingType.NaniteFactory,
		condition: RequirementValueGetters.IS_SPECIFIC_BUILDING_BEING_UPGRADED,
		operator: RequirementType.RequirementOperator.Equal,
		value: false,}]],
]);
//#endregion

//#region Research
export const REASEARCH_INFO: ReadonlyMap<GameType.ResearchType, GameType.ResearchInfo> = new Map<GameType.ResearchType, GameType.ResearchInfo>
([
	[GameType.ResearchType.EnergyTech, { displayName: "Energy Technology",
		costFunctionType: GameType.ResearchCostFunctionType.SimpleExponential,
		costStats: {
			baseCostExponent: 2,
			baseCost: new Map<GameType.ResourceType, number>([
				[GameType.ResourceType.Crystal, 800],
				[GameType.ResourceType.Deuterium, 400],]),},}],


	[GameType.ResearchType.CombustionDrive, { displayName: "Combustion Drive",
		costFunctionType: GameType.ResearchCostFunctionType.SimpleExponential,
		costStats: {
			baseCostExponent: 2,
			baseCost: new Map<GameType.ResourceType, number>([
				[GameType.ResourceType.Metal, 400],
				[GameType.ResourceType.Deuterium, 600],]),},

		requirements:[
		{
			hideDataWhenRequirementFailed: true,
			thingType: ThingType.Thing.Research,
			specificThingType: GameType.ResearchType.EnergyTech,
			condition: RequirementValueGetters.RESEARCH_LEVEL,
			operator: RequirementType.RequirementOperator.GreaterOrEqual,
			value: 1,},],}],


    [GameType.ResearchType.ImpulseDrive, { displayName: "Impulse Drive",
		costFunctionType: GameType.ResearchCostFunctionType.SimpleExponential,
		costStats: {
			baseCostExponent: 2,
			baseCost: new Map<GameType.ResourceType, number>([
				[GameType.ResourceType.Metal, 2000],
				[GameType.ResourceType.Crystal, 4000],
				[GameType.ResourceType.Deuterium, 600],]),},

		requirements:[
		{
			hideDataWhenRequirementFailed: true,
			thingType: ThingType.Thing.Research,
			specificThingType: GameType.ResearchType.EnergyTech,
			condition: RequirementValueGetters.RESEARCH_LEVEL,
			operator: RequirementType.RequirementOperator.GreaterOrEqual,
			value: 1,},
		{
			hideDataWhenRequirementFailed: true,
			thingType: ThingType.Thing.Building,
			specificThingType: GameType.BuildingType.ResearchLab,
			condition: RequirementValueGetters.BUILDING_LEVEL,
			operator: RequirementType.RequirementOperator.GreaterOrEqual,
			value: 2,},],}],


    [GameType.ResearchType.HyperspaceDrive, { displayName: "Hyperspace Drive",
		costFunctionType: GameType.ResearchCostFunctionType.SimpleExponential,
		costStats: {
			baseCostExponent: 2,
			baseCost: new Map<GameType.ResourceType, number>([
				[GameType.ResourceType.Metal, 10000],
				[GameType.ResourceType.Crystal, 20000],
				[GameType.ResourceType.Deuterium, 6000],]),},

		requirements:[
		{
			hideDataWhenRequirementFailed: true,
			thingType: ThingType.Thing.Research,
			specificThingType: GameType.ResearchType.EnergyTech,
			condition: RequirementValueGetters.RESEARCH_LEVEL,
			operator: RequirementType.RequirementOperator.GreaterOrEqual,
			value: 5,},
		{
			hideDataWhenRequirementFailed: true,
			thingType: ThingType.Thing.Building,
			specificThingType: GameType.BuildingType.ResearchLab,
			condition: RequirementValueGetters.BUILDING_LEVEL,
			operator: RequirementType.RequirementOperator.GreaterOrEqual,
			value: 7,},
		{
			hideDataWhenRequirementFailed: true,
			thingType: ThingType.Thing.Research,
			specificThingType: GameType.ResearchType.ShieldingTech,
			condition: RequirementValueGetters.RESEARCH_LEVEL,
			operator: RequirementType.RequirementOperator.GreaterOrEqual,
			value: 5,},
		{
			hideDataWhenRequirementFailed: true,
			thingType: ThingType.Thing.Research,
			specificThingType: GameType.ResearchType.HyperspaceTech,
			condition: RequirementValueGetters.RESEARCH_LEVEL,
			operator: RequirementType.RequirementOperator.GreaterOrEqual,
			value: 3,},],}],


    [GameType.ResearchType.ComputerTech, { displayName: "Computer Technology",
		costFunctionType: GameType.ResearchCostFunctionType.SimpleExponential,
		costStats: {
			baseCostExponent: 2,
			baseCost: new Map<GameType.ResourceType, number>([
				[GameType.ResourceType.Crystal, 400],
				[GameType.ResourceType.Deuterium, 600],]),},

		playerValueStats: [
			{playerValueProductionFormulasType:
				GameType.PlayerValueProductionFormulasType.ProportionalOneToOne,
				playerValueType: GameType.PlayerValueType.FleetSlots,
				basePlayerValueFactor: 1,}],}],


	[GameType.ResearchType.EspionageTech, { displayName: "Espionage Technology",
		costFunctionType: GameType.ResearchCostFunctionType.SimpleExponential,
		costStats: {
			baseCostExponent: 2,
			baseCost: new Map<GameType.ResourceType, number>([
				[GameType.ResourceType.Metal, 200],
				[GameType.ResourceType.Crystal, 1000],
				[GameType.ResourceType.Deuterium, 200],]),},

		requirements:[
		{
			hideDataWhenRequirementFailed: true,
			thingType: ThingType.Thing.Building,
			specificThingType: GameType.BuildingType.ResearchLab,
			condition: RequirementValueGetters.BUILDING_LEVEL,
			operator: RequirementType.RequirementOperator.GreaterOrEqual,
			value: 3,},],}],


	[GameType.ResearchType.WeaponTech, { displayName: "Weapons Technology",
		costFunctionType: GameType.ResearchCostFunctionType.SimpleExponential,
		costStats: {
			baseCostExponent: 2,
			baseCost: new Map<GameType.ResourceType, number>([
				[GameType.ResourceType.Metal, 800],
				[GameType.ResourceType.Crystal, 200],]),},

		requirements:[
		{
			hideDataWhenRequirementFailed: true,
			thingType: ThingType.Thing.Building,
			specificThingType: GameType.BuildingType.ResearchLab,
			condition: RequirementValueGetters.BUILDING_LEVEL,
			operator: RequirementType.RequirementOperator.GreaterOrEqual,
			value: 4,},],}],


	[GameType.ResearchType.ShieldingTech, { displayName: "Shielding Technology",
		costFunctionType: GameType.ResearchCostFunctionType.SimpleExponential,
		costStats: {
			baseCostExponent: 2,
			baseCost: new Map<GameType.ResourceType, number>([
				[GameType.ResourceType.Metal, 200],
				[GameType.ResourceType.Crystal, 600],]),},

		requirements:[
		{
			hideDataWhenRequirementFailed: true,
			thingType: ThingType.Thing.Building,
			specificThingType: GameType.BuildingType.ResearchLab,
			condition: RequirementValueGetters.BUILDING_LEVEL,
			operator: RequirementType.RequirementOperator.GreaterOrEqual,
			value: 6,},
		{
			hideDataWhenRequirementFailed: true,
			thingType: ThingType.Thing.Research,
			specificThingType: GameType.ResearchType.EnergyTech,
			condition: RequirementValueGetters.RESEARCH_LEVEL,
			operator: RequirementType.RequirementOperator.GreaterOrEqual,
			value: 3,},],}],


	[GameType.ResearchType.ArmourTech, { displayName: "Armour Technology",
		costFunctionType: GameType.ResearchCostFunctionType.SimpleExponential,
		costStats: {
			baseCostExponent: 2,
			baseCost: new Map<GameType.ResourceType, number>([
				[GameType.ResourceType.Metal, 1000],]),},

		requirements:[
		{
			hideDataWhenRequirementFailed: true,
			thingType: ThingType.Thing.Building,
			specificThingType: GameType.BuildingType.ResearchLab,
			condition: RequirementValueGetters.BUILDING_LEVEL,
			operator: RequirementType.RequirementOperator.GreaterOrEqual,
			value: 2,},],}],


	[GameType.ResearchType.Astrophysics, { displayName: "Astrophysics",
		costFunctionType: GameType.ResearchCostFunctionType.SimpleExponential,
		costStats: {
			baseCostExponent: 1.75,
			baseCost: new Map<GameType.ResourceType, number>([
				[GameType.ResourceType.Metal, 4000],
				[GameType.ResourceType.Crystal, 8000],
				[GameType.ResourceType.Deuterium, 4000],]),},

		playerValueStats: [
			{playerValueProductionFormulasType:
				GameType.PlayerValueProductionFormulasType.FlooredLinearClamped,
				playerValueType: GameType.PlayerValueType.ColonySlots,
				basePlayerValueFactor: 0.5,}],

		requirements:[
		{
			hideDataWhenRequirementFailed: true,
			thingType: ThingType.Thing.Research,
			specificThingType: GameType.ResearchType.EspionageTech,
			condition: RequirementValueGetters.RESEARCH_LEVEL,
			operator: RequirementType.RequirementOperator.GreaterOrEqual,
			value: 4,},
		{
			hideDataWhenRequirementFailed: true,
			thingType: ThingType.Thing.Research,
			specificThingType: GameType.ResearchType.ImpulseDrive,
			condition: RequirementValueGetters.RESEARCH_LEVEL,
			operator: RequirementType.RequirementOperator.GreaterOrEqual,
			value: 3,},
		{
			hideDataWhenRequirementFailed: true,
			thingType: ThingType.Thing.Building,
			specificThingType: GameType.BuildingType.ResearchLab,
			condition: RequirementValueGetters.BUILDING_LEVEL,
			operator: RequirementType.RequirementOperator.GreaterOrEqual,
			value: 3,},],}],


	[GameType.ResearchType.IntergalacticResearchNetwork, { displayName: "Intergalactic Research Network",
		costFunctionType: GameType.ResearchCostFunctionType.SimpleExponential,
		costStats: {
			baseCostExponent: 2,
			baseCost: new Map<GameType.ResourceType, number>([
				[GameType.ResourceType.Metal, 240000],
				[GameType.ResourceType.Crystal, 400000],
				[GameType.ResourceType.Deuterium, 160000],]),},

		requirements:[
		{
			hideDataWhenRequirementFailed: true,
			thingType: ThingType.Thing.Building,
			specificThingType: GameType.BuildingType.ResearchLab,
			condition: RequirementValueGetters.BUILDING_LEVEL,
			operator: RequirementType.RequirementOperator.GreaterOrEqual,
			value: 10,},
		{
			hideDataWhenRequirementFailed: true,
			thingType: ThingType.Thing.Research,
			specificThingType: GameType.ResearchType.ComputerTech,
			condition: RequirementValueGetters.RESEARCH_LEVEL,
			operator: RequirementType.RequirementOperator.GreaterOrEqual,
			value: 8,},
		{
			hideDataWhenRequirementFailed: true,
			thingType: ThingType.Thing.Research,
			specificThingType: GameType.ResearchType.HyperspaceTech,
			condition: RequirementValueGetters.RESEARCH_LEVEL,
			operator: RequirementType.RequirementOperator.GreaterOrEqual,
			value: 8,},],}],


	[GameType.ResearchType.GravitonTech, { displayName: "Graviton Technology",
		costFunctionType: GameType.ResearchCostFunctionType.Free,
		fixedResearchDurationSeconds: 1,

		requirements:[
		{
			hideDataWhenRequirementFailed: true,
			thingType: ThingType.Thing.Building,
			specificThingType: GameType.BuildingType.ResearchLab,
			condition: RequirementValueGetters.BUILDING_LEVEL,
			operator: RequirementType.RequirementOperator.GreaterOrEqual,
			value: 12,},
		{
			hideDataWhenRequirementFailed: true,
			thingType: ThingType.Thing.PlanetValue,
			specificThingType: GameType.PlanetValueType.Energy,
			condition: RequirementValueGetters.ENERGY_PRODUCTION,
			operator: RequirementType.RequirementOperator.GreaterOrEqual,
			value: RequirementValueGetters.gravitonEnergyRequirement(),},],}],


	[GameType.ResearchType.LaserTech, { displayName: "Laser Technology",
		costFunctionType: GameType.ResearchCostFunctionType.SimpleExponential,
		costStats: {
			baseCostExponent: 2,
			baseCost: new Map<GameType.ResourceType, number>([
				[GameType.ResourceType.Metal, 200],
				[GameType.ResourceType.Crystal, 100],]),},

		requirements:[
		{
			hideDataWhenRequirementFailed: true,
			thingType: ThingType.Thing.Research,
			specificThingType: GameType.ResearchType.EnergyTech,
			condition: RequirementValueGetters.RESEARCH_LEVEL,
			operator: RequirementType.RequirementOperator.GreaterOrEqual,
			value: 2,},
		{
			hideDataWhenRequirementFailed: true,
			thingType: ThingType.Thing.Building,
			specificThingType: GameType.BuildingType.ResearchLab,
			condition: RequirementValueGetters.BUILDING_LEVEL,
			operator: RequirementType.RequirementOperator.GreaterOrEqual,
			value: 1,},],}],


	[GameType.ResearchType.IonTech, { displayName: "Ion Technology",
		costFunctionType: GameType.ResearchCostFunctionType.SimpleExponential,
		costStats: {
			baseCostExponent: 2,
			baseCost: new Map<GameType.ResourceType, number>([
				[GameType.ResourceType.Metal, 1000],
				[GameType.ResourceType.Crystal, 300],
				[GameType.ResourceType.Deuterium, 100],]),},

		playerValueStats: [
			{playerValueProductionFormulasType:
				GameType.PlayerValueProductionFormulasType.LinearClamped,
				playerValueType: GameType.PlayerValueType.DeconstructionCostModificationPercent,
				basePlayerValueFactor: -4,
				minPlayerValue: -100,}],

		requirements:[
		{
			hideDataWhenRequirementFailed: true,
			thingType: ThingType.Thing.Building,
			specificThingType: GameType.BuildingType.ResearchLab,
			condition: RequirementValueGetters.BUILDING_LEVEL,
			operator: RequirementType.RequirementOperator.GreaterOrEqual,
			value: 4,},
		{
			hideDataWhenRequirementFailed: true,
			thingType: ThingType.Thing.Research,
			specificThingType: GameType.ResearchType.EnergyTech,
			condition: RequirementValueGetters.RESEARCH_LEVEL,
			operator: RequirementType.RequirementOperator.GreaterOrEqual,
			value: 4,},
		{
			hideDataWhenRequirementFailed: true,
			thingType: ThingType.Thing.Research,
			specificThingType: GameType.ResearchType.LaserTech,
			condition: RequirementValueGetters.RESEARCH_LEVEL,
			operator: RequirementType.RequirementOperator.GreaterOrEqual,
			value: 5,},],}],


	[GameType.ResearchType.PlasmaTech, { displayName: "Plasma Technology",
		costFunctionType: GameType.ResearchCostFunctionType.SimpleExponential,
		costStats: {
			baseCostExponent: 2,
			baseCost: new Map<GameType.ResourceType, number>([
				[GameType.ResourceType.Metal, 2000],
				[GameType.ResourceType.Crystal, 4000],
				[GameType.ResourceType.Deuterium, 1000],]),},

		playerValueStats: [
			{playerValueProductionFormulasType:
				GameType.PlayerValueProductionFormulasType.LinearClamped,
				playerValueType: GameType.PlayerValueType.MetalProductionModificationPercent,
				basePlayerValueFactor: 1,},
			{playerValueProductionFormulasType:
				GameType.PlayerValueProductionFormulasType.LinearClamped,
				playerValueType: GameType.PlayerValueType.CrystalProductionModificationPercent,
				basePlayerValueFactor: 0.66,},
			{playerValueProductionFormulasType:
				GameType.PlayerValueProductionFormulasType.LinearClamped,
				playerValueType: GameType.PlayerValueType.DeuteriumProductionModificationPercent,
				basePlayerValueFactor: 0.33,}],

		requirements:[
		{
			hideDataWhenRequirementFailed: true,
			thingType: ThingType.Thing.Building,
			specificThingType: GameType.BuildingType.ResearchLab,
			condition: RequirementValueGetters.BUILDING_LEVEL,
			operator: RequirementType.RequirementOperator.GreaterOrEqual,
			value: 4,},
		{
			hideDataWhenRequirementFailed: true,
			thingType: ThingType.Thing.Research,
			specificThingType: GameType.ResearchType.EnergyTech,
			condition: RequirementValueGetters.RESEARCH_LEVEL,
			operator: RequirementType.RequirementOperator.GreaterOrEqual,
			value: 8,},
		{
			hideDataWhenRequirementFailed: true,
			thingType: ThingType.Thing.Research,
			specificThingType: GameType.ResearchType.LaserTech,
			condition: RequirementValueGetters.RESEARCH_LEVEL,
			operator: RequirementType.RequirementOperator.GreaterOrEqual,
			value: 10,},
		{
			hideDataWhenRequirementFailed: true,
			thingType: ThingType.Thing.Research,
			specificThingType: GameType.ResearchType.IonTech,
			condition: RequirementValueGetters.RESEARCH_LEVEL,
			operator: RequirementType.RequirementOperator.GreaterOrEqual,
			value: 5,},],}],


	[GameType.ResearchType.HyperspaceTech, { displayName: "Hyperspace Technology",
		costFunctionType: GameType.ResearchCostFunctionType.SimpleExponential,
		costStats: {
			baseCostExponent: 2,
			baseCost: new Map<GameType.ResourceType, number>([
				[GameType.ResourceType.Crystal, 4000],
				[GameType.ResourceType.Deuterium, 2000],]),},

		playerValueStats: [
			{playerValueProductionFormulasType:
				GameType.PlayerValueProductionFormulasType.LinearClamped,
				playerValueType: GameType.PlayerValueType.FleetSpaceModificationPercent,
				basePlayerValueFactor: 5,}],

		requirements:[
		{
			hideDataWhenRequirementFailed: true,
			thingType: ThingType.Thing.Building,
			specificThingType: GameType.BuildingType.ResearchLab,
			condition: RequirementValueGetters.BUILDING_LEVEL,
			operator: RequirementType.RequirementOperator.GreaterOrEqual,
			value: 7,},
		{
			hideDataWhenRequirementFailed: true,
			thingType: ThingType.Thing.Research,
			specificThingType: GameType.ResearchType.EnergyTech,
			condition: RequirementValueGetters.RESEARCH_LEVEL,
			operator: RequirementType.RequirementOperator.GreaterOrEqual,
			value: 5,},
		{
			hideDataWhenRequirementFailed: true,
			thingType: ThingType.Thing.Research,
			specificThingType: GameType.ResearchType.ShieldingTech,
			condition: RequirementValueGetters.RESEARCH_LEVEL,
			operator: RequirementType.RequirementOperator.GreaterOrEqual,
			value: 5,},],}],
]);

//#endregion