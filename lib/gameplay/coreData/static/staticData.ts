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
	specificThingRequirement: {
		thingType: ThingType.Thing.Building,
		specificThingType: GameType.BuildingType.LunarBase,
		operator: RequirementType.RequirementOperator.GreaterOrEqual,
		value: 1,
		valueGetter: RequirementValueGetters.buildingLevel(GameType.BuildingType.LunarBase),},
};

export const BUILDING_STATS: ReadonlyMap<GameType.BuildingType, GameType.BuildingStats> = new Map<GameType.BuildingType, GameType.BuildingStats>
([
    [GameType.BuildingType.MetalMine, { displayName: "Metal Mine",
		buildableZones: [GameType.PlanetZone.Planet],
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

		planetValueStats: [{
			planetValueProductionFormulasType: GameType.BuildingPlanetValueProductionFormulasType.SimpleExponential,
			basePlanetValueFactor: new Map<GameType.PlanetValueType, number>([
				[GameType.PlanetValueType.Energy, -10],]),
			basePlanetValueExponent: 1.1,}],
	}],


	[GameType.BuildingType.MetalStorage, { displayName: "Metal Storage",
		buildableZones: [GameType.PlanetZone.Planet, GameType.PlanetZone.Moon],
		upgradeRequirements: [LUNAR_BASE_REQUIREMENT],
		costFunctionType: GameType.BuildingCostFunctionType.SimpleExponential,
		costStats: {
			baseCostExponent: 2,
			baseCost: new Map<GameType.ResourceType, number>([
				[GameType.ResourceType.Metal, 1000],]),},

		planetValueStats: [{
			planetValueProductionFormulasType: GameType.BuildingPlanetValueProductionFormulasType.FlooredNaturalExponential,
			basePlanetValueFactor: new Map<GameType.PlanetValueType, number>([
				[GameType.PlanetValueType.MetalStorage, 5000],]),
			naturalExponentialFactor: 2.5,
			naturalExponentialExponentFactor: 20/33,}],
	}],


	[GameType.BuildingType.CrystalGrower, { displayName: "Crystal Grower",
		buildableZones: [GameType.PlanetZone.Planet],
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

		planetValueStats: [{
			planetValueProductionFormulasType: GameType.BuildingPlanetValueProductionFormulasType.SimpleExponential,
			basePlanetValueFactor: new Map<GameType.PlanetValueType, number>([
				[GameType.PlanetValueType.Energy, -10],]),
			basePlanetValueExponent: 1.1,}],
	}],


	[GameType.BuildingType.CrystalContainement, { displayName: "Crystal Containement",
		buildableZones: [GameType.PlanetZone.Planet, GameType.PlanetZone.Moon],
		upgradeRequirements: [LUNAR_BASE_REQUIREMENT],
		costFunctionType: GameType.BuildingCostFunctionType.SimpleExponential,
		costStats: {
			baseCostExponent: 2,
			baseCost: new Map<GameType.ResourceType, number>([
				[GameType.ResourceType.Metal, 500],
				[GameType.ResourceType.Crystal, 500],]),},

		planetValueStats: [{
			planetValueProductionFormulasType: GameType.BuildingPlanetValueProductionFormulasType.FlooredNaturalExponential,
			basePlanetValueFactor: new Map<GameType.PlanetValueType, number>([
				[GameType.PlanetValueType.CrystalStorage, 5000],]),
			naturalExponentialFactor: 2.5,
			naturalExponentialExponentFactor: 20/33,}],
	}],


	[GameType.BuildingType.DeuteriumSynthesizer, { displayName: "Deuterium Synthesizer",
		buildableZones: [GameType.PlanetZone.Planet],
		costFunctionType: GameType.BuildingCostFunctionType.SimpleExponential,
		costStats: {
			baseCostExponent: 2,
			baseCost: new Map<GameType.ResourceType, number>([
				[GameType.ResourceType.Metal, 225],
				[GameType.ResourceType.Crystal, 75],]),},

		productionFunctionType: GameType.ProductionFunctionType.TemperatureScaledProductionBuilding,
		productionStats: new Map<GameType.ResourceType, GameType.ProductionStats>([
			[GameType.ResourceType.Deuterium, {
				minProductionPerHour: 0,
				productionFactor: 10,
				exponentBase: 1.1,}]]),

		planetValueStats: [{
			planetValueProductionFormulasType: GameType.BuildingPlanetValueProductionFormulasType.SimpleExponential,
			basePlanetValueFactor: new Map<GameType.PlanetValueType, number>([
				[GameType.PlanetValueType.Energy, -20],]),
			basePlanetValueExponent: 1.1,}],
	}],


	[GameType.BuildingType.DeuteriumTank, { displayName: "Deuterium Tank",
		buildableZones: [GameType.PlanetZone.Planet, GameType.PlanetZone.Moon],
		upgradeRequirements: [LUNAR_BASE_REQUIREMENT],
		costFunctionType: GameType.BuildingCostFunctionType.SimpleExponential,
		costStats: {
			baseCostExponent: 2,
			baseCost: new Map<GameType.ResourceType, number>([
				[GameType.ResourceType.Metal, 1000],
				[GameType.ResourceType.Crystal, 1000],]),},

		planetValueStats: [{
			planetValueProductionFormulasType: GameType.BuildingPlanetValueProductionFormulasType.FlooredNaturalExponential,
			basePlanetValueFactor: new Map<GameType.PlanetValueType, number>([
				[GameType.PlanetValueType.DeuteriumStorage, 5000],]),
			naturalExponentialFactor: 2.5,
			naturalExponentialExponentFactor: 20/33,}],
	}],


	[GameType.BuildingType.SolarPlant, { displayName: "Solar Plant",
		buildableZones: [GameType.PlanetZone.Planet],
		costFunctionType: GameType.BuildingCostFunctionType.SimpleExponential,
		costStats: {
			baseCostExponent: 1.5,
			baseCost: new Map<GameType.ResourceType, number>([
				[GameType.ResourceType.Metal, 75],
				[GameType.ResourceType.Crystal, 30],]),},

		planetValueStats: [{
			planetValueProductionFormulasType: GameType.BuildingPlanetValueProductionFormulasType.SimpleExponential,
			basePlanetValueFactor: new Map<GameType.PlanetValueType, number>([
				[GameType.PlanetValueType.Energy, 20],]),
			basePlanetValueExponent: 1.1,}],
	}],


	[GameType.BuildingType.Shipyard, { displayName: "Shipyard",
		buildableZones: [GameType.PlanetZone.Planet, GameType.PlanetZone.Moon],
		upgradeRequirements:[{
			hideDataWhenRequirementFailed: true,
			specificThingRequirement:{
				thingType: ThingType.Thing.Building,
				specificThingType: GameType.BuildingType.RoboticFactory,
				operator: RequirementType.RequirementOperator.GreaterOrEqual,
				value: 2,
				valueGetter: RequirementValueGetters.buildingLevel(GameType.BuildingType.RoboticFactory),},},
			LUNAR_BASE_REQUIREMENT,
			{
			hideDataWhenRequirementFailed: false,
			thingRequirement: {
				thingType: ThingType.Thing.UnitConstruction,
				operator: RequirementType.RequirementOperator.Equal,
				value: false,
				valueGetter: RequirementValueGetters.isAnyUnitBeingConstructed(),},},],
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
		upgradeRequirements: [LUNAR_BASE_REQUIREMENT],
		costFunctionType: GameType.BuildingCostFunctionType.SimpleExponential,
		costStats: {
			baseCostExponent: 1.5,
			baseCost: new Map<GameType.ResourceType, number>([
				[GameType.ResourceType.Metal, 400],
				[GameType.ResourceType.Crystal, 120],
				[GameType.ResourceType.Deuterium, 200],]),},
	},],

	[GameType.BuildingType.ResearchLab, { displayName: "Research Lab",
		buildableZones: [GameType.PlanetZone.Planet],
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
		upgradeRequirements:[{
			hideDataWhenRequirementFailed: true,
			specificThingRequirement:{
				thingType: ThingType.Thing.Building,
				specificThingType: GameType.BuildingType.RoboticFactory,
				operator: RequirementType.RequirementOperator.GreaterOrEqual,
				value: 10,
				valueGetter: RequirementValueGetters.buildingLevel(GameType.BuildingType.RoboticFactory),},},
			{hideDataWhenRequirementFailed: true,
			specificThingRequirement:{
				thingType: ThingType.Thing.Research,
				specificThingType: GameType.ResearchType.ComputerTech,
				operator: RequirementType.RequirementOperator.GreaterOrEqual,
				value: 10,
				valueGetter: RequirementValueGetters.researchLevel(GameType.ResearchType.ComputerTech),},},
			{
			hideDataWhenRequirementFailed: false,
			thingRequirement: {
				thingType: ThingType.Thing.UnitConstruction,
				operator: RequirementType.RequirementOperator.Equal,
				value: false,
				valueGetter: RequirementValueGetters.isAnyUnitBeingConstructed(),},},],
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
		upgradeRequirements:[{
			hideDataWhenRequirementFailed: true,
			specificThingRequirement:{
				thingType: ThingType.Thing.Building,
				specificThingType: GameType.BuildingType.DeuteriumSynthesizer,
				operator: RequirementType.RequirementOperator.GreaterOrEqual,
				value: 5,
				valueGetter: RequirementValueGetters.buildingLevel(GameType.BuildingType.DeuteriumSynthesizer),},},
			{hideDataWhenRequirementFailed: true,
			specificThingRequirement:{
				thingType: ThingType.Thing.Research,
				specificThingType: GameType.ResearchType.EnergyTech,
				operator: RequirementType.RequirementOperator.GreaterOrEqual,
				value: 3,
				valueGetter: RequirementValueGetters.researchLevel(GameType.ResearchType.EnergyTech),},},],
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

		planetValueStats: [{
			planetValueProductionFormulasType: GameType.BuildingPlanetValueProductionFormulasType.ResearchScaledExponential,
			basePlanetValueFactor: new Map<GameType.PlanetValueType, number>([
				[GameType.PlanetValueType.Energy, 30],]),
			researchScalingResearchType: GameType.ResearchType.EnergyTech,
			researchScalingBaseFactor: 1.05,
			researchScalingPerLevelFactor: 0.01,}],
	},],

	[GameType.BuildingType.Terraformer, { displayName: "Terraformer",
		buildableZones: [GameType.PlanetZone.Planet],
		canDeconstruct: false,
		upgradeRequirements:[{
			hideDataWhenRequirementFailed: true,
			specificThingRequirement:{
				thingType: ThingType.Thing.Building,
				specificThingType: GameType.BuildingType.RoboticFactory,
				operator: RequirementType.RequirementOperator.GreaterOrEqual,
				value: 1,
				valueGetter: RequirementValueGetters.buildingLevel(GameType.BuildingType.RoboticFactory),},},],
		costFunctionType: GameType.BuildingCostFunctionType.SimpleExponential,
		costStats: {
			baseCostExponent: 2,
			baseCost: new Map<GameType.ResourceType, number>([
				[GameType.ResourceType.Crystal, 50000],
				[GameType.ResourceType.Deuterium, 100000],]),},

		planetValueStats: [{
			planetValueProductionFormulasType: GameType.BuildingPlanetValueProductionFormulasType.SimpleExponential,
			basePlanetValueFactor: new Map<GameType.PlanetValueType, number>([
				[GameType.PlanetValueType.Size, 5.5],]),
			basePlanetValueExponent: 1,}],
	},],

	[GameType.BuildingType.LunarBase, { displayName: "Lunar Base",
		buildableZones: [GameType.PlanetZone.Moon],
		canDeconstruct: false,
		costFunctionType: GameType.BuildingCostFunctionType.SimpleExponential,
		costStats: {
			baseCostExponent: 2,
			baseCost: new Map<GameType.ResourceType, number>([
				[GameType.ResourceType.Metal, 20000],
				[GameType.ResourceType.Crystal, 40000],
				[GameType.ResourceType.Deuterium, 20000],]),},

		planetValueStats: [{
			planetValueProductionFormulasType: GameType.BuildingPlanetValueProductionFormulasType.SimpleExponential,
			basePlanetValueFactor: new Map<GameType.PlanetValueType, number>([
				[GameType.PlanetValueType.Size, 3],]),
			basePlanetValueExponent: 1,}],
	},],

	[GameType.BuildingType.MissileSilo, { displayName: "Missile Silo",
		buildableZones: [GameType.PlanetZone.Planet],
		upgradeRequirements:[{
			hideDataWhenRequirementFailed: true,
			specificThingRequirement:{
				thingType: ThingType.Thing.Building,
				specificThingType: GameType.BuildingType.Shipyard,
				operator: RequirementType.RequirementOperator.GreaterOrEqual,
				value: 1,
				valueGetter: RequirementValueGetters.buildingLevel(GameType.BuildingType.Shipyard),},},],
		costFunctionType: GameType.BuildingCostFunctionType.SimpleExponential,
		costStats: {
			baseCostExponent: 2,
			baseCost: new Map<GameType.ResourceType, number>([
				[GameType.ResourceType.Metal, 20000],
				[GameType.ResourceType.Crystal, 20000],
				[GameType.ResourceType.Deuterium, 1000],]),},

		planetValueStats: [{
			planetValueProductionFormulasType: GameType.BuildingPlanetValueProductionFormulasType.SimpleExponential,
			basePlanetValueFactor: new Map<GameType.PlanetValueType, number>([
				[GameType.PlanetValueType.MissileSpace, 10],]),
			basePlanetValueExponent: 1,}],
	},],
]);
//#endregion

//#region Units
export const UNIT_STATS: ReadonlyMap<GameType.UnitType, GameType.UnitStats> = new Map<GameType.UnitType, GameType.UnitStats>
([
    [GameType.UnitType.SmallTransport, { displayName: "Small Transport",
		category: GameType.UnitCategory.Ship,
		queueType: GameType.UnitConstructionQueueType.Shipyard,
		requirements:[{
			hideDataWhenRequirementFailed: true,
			specificThingRequirement:{
				thingType: ThingType.Thing.Building,
				specificThingType: GameType.BuildingType.Shipyard,
				operator: RequirementType.RequirementOperator.GreaterOrEqual,
				value: 2,
				valueGetter: RequirementValueGetters.buildingLevel(GameType.BuildingType.Shipyard),},},],
		costMap: new Map<GameType.ResourceType, number>([
			[GameType.ResourceType.Metal, 2000],
			[GameType.ResourceType.Crystal, 2000],]),
		maxHealth: 4000,
		space: 5000,
		speed: [
			{ engineTech: GameType.ResearchType.CombustionDrive, researchLevel: 0, value: 5000},
			{ engineTech: GameType.ResearchType.ImpulseDrive, researchLevel: 5, value: 10000}],
		baseFuelConsumption: [
			{ engineTech: GameType.ResearchType.CombustionDrive, researchLevel:0, value: new Map<GameType.ResourceType, number>([[GameType.ResourceType.Deuterium, 10]])},
			{ engineTech: GameType.ResearchType.ImpulseDrive, researchLevel:5, value: new Map<GameType.ResourceType, number>([[GameType.ResourceType.Deuterium, 20]])},],
	}],


    [GameType.UnitType.LargeTransport, { displayName: "Large Transport",
		category: GameType.UnitCategory.Ship,
		queueType: GameType.UnitConstructionQueueType.Shipyard,
		requirements:[{
			hideDataWhenRequirementFailed: true,
			specificThingRequirement:{
				thingType: ThingType.Thing.Building,
				specificThingType: GameType.BuildingType.Shipyard,
				operator: RequirementType.RequirementOperator.GreaterOrEqual,
				value: 6,
				valueGetter: RequirementValueGetters.buildingLevel(GameType.BuildingType.Shipyard),},},],
		costMap: new Map<GameType.ResourceType, number>([
			[GameType.ResourceType.Metal, 6000],
			[GameType.ResourceType.Crystal, 6000],]),
		maxHealth: 12000,
		space: 25000,
		speed:  [
			{ engineTech: GameType.ResearchType.CombustionDrive, researchLevel: 0, value: 7500}],
		baseFuelConsumption: [
			{ engineTech: GameType.ResearchType.CombustionDrive, researchLevel: 0, value: new Map<GameType.ResourceType, number>([[GameType.ResourceType.Deuterium, 50]])},],
	}],


    [GameType.UnitType.ColonyShip, { displayName: "Colony Ship",
		category: GameType.UnitCategory.Ship,
		queueType: GameType.UnitConstructionQueueType.Shipyard,
		requirements:[{
			hideDataWhenRequirementFailed: true,
			specificThingRequirement:{
				thingType: ThingType.Thing.Building,
				specificThingType: GameType.BuildingType.Shipyard,
				operator: RequirementType.RequirementOperator.GreaterOrEqual,
				value: 4,
				valueGetter: RequirementValueGetters.buildingLevel(GameType.BuildingType.Shipyard),},},],
		costMap: new Map<GameType.ResourceType, number>([
			[GameType.ResourceType.Metal, 10000],
			[GameType.ResourceType.Crystal, 20000],
			[GameType.ResourceType.Deuterium, 10000],]),
		maxHealth: 30000,
		space: 7500,
		speed:  [
			{ engineTech: GameType.ResearchType.ImpulseDrive, researchLevel: 0, value: 2500}],
		baseFuelConsumption: [
			{ engineTech: GameType.ResearchType.ImpulseDrive, researchLevel: 0, value: new Map<GameType.ResourceType, number>([[GameType.ResourceType.Deuterium, 1000]])},],
	}],
    [GameType.UnitType.Recycler, { displayName: "Recycler",
		category: GameType.UnitCategory.Ship,
		queueType: GameType.UnitConstructionQueueType.Shipyard,
		requirements:[{
			hideDataWhenRequirementFailed: true,
			specificThingRequirement:{
				thingType: ThingType.Thing.Building,
				specificThingType: GameType.BuildingType.Shipyard,
				operator: RequirementType.RequirementOperator.GreaterOrEqual,
				value: 4,
				valueGetter: RequirementValueGetters.buildingLevel(GameType.BuildingType.Shipyard),},},],
		costMap: new Map<GameType.ResourceType, number>([
			[GameType.ResourceType.Metal, 10000],
			[GameType.ResourceType.Crystal, 6000],
			[GameType.ResourceType.Deuterium, 2000],]),
		maxHealth: 16000,
		space: 20000,
		speed: [
			{ engineTech: GameType.ResearchType.CombustionDrive, researchLevel: 0, value: 2000},
			{ engineTech: GameType.ResearchType.ImpulseDrive, researchLevel: 17, value: 4000},
			{ engineTech: GameType.ResearchType.HyperspaceDrive, researchLevel: 15, value: 6000}],
		baseFuelConsumption: [
			{ engineTech: GameType.ResearchType.CombustionDrive, researchLevel: 0, value: new Map<GameType.ResourceType, number>([[GameType.ResourceType.Deuterium, 300]])},
			{ engineTech: GameType.ResearchType.ImpulseDrive, researchLevel: 17, value: new Map<GameType.ResourceType, number>([[GameType.ResourceType.Deuterium, 600]])},
			{ engineTech: GameType.ResearchType.HyperspaceDrive, researchLevel: 15, value: new Map<GameType.ResourceType, number>([[GameType.ResourceType.Deuterium, 900]])},],
		canTargetDebrisField: true,
	}],
	[GameType.UnitType.EspionageProbe, { displayName: "Espionage Probe",
		category: GameType.UnitCategory.Ship,
		queueType: GameType.UnitConstructionQueueType.Shipyard,
		requirements:[
			{hideDataWhenRequirementFailed: true,
			specificThingRequirement:{
				thingType: ThingType.Thing.Building,
				specificThingType: GameType.BuildingType.Shipyard,
				operator: RequirementType.RequirementOperator.GreaterOrEqual,
				value: 3,
				valueGetter: RequirementValueGetters.buildingLevel(GameType.BuildingType.Shipyard),},},
			{hideDataWhenRequirementFailed: true,
			specificThingRequirement:{
				thingType: ThingType.Thing.Research,
				specificThingType: GameType.ResearchType.EspionageTech,
				operator: RequirementType.RequirementOperator.GreaterOrEqual,
				value: 1,
				valueGetter: RequirementValueGetters.researchLevel(GameType.ResearchType.EspionageTech),},},],
		costMap: new Map<GameType.ResourceType, number>([
			[GameType.ResourceType.Crystal, 1000],]),
		maxHealth: 1000,
		space: 5,
		speed: [
			{ engineTech: GameType.ResearchType.CombustionDrive, researchLevel: 0, value: 100000000}],
		baseFuelConsumption: [
			{ engineTech: GameType.ResearchType.CombustionDrive, researchLevel: 0, value: new Map<GameType.ResourceType, number>([[GameType.ResourceType.Deuterium, 1]])},],
		canSpy: true,
	}],
	[GameType.UnitType.RocketLauncher, { displayName: "Rocket Launcher",
		category: GameType.UnitCategory.Defense,
		queueType: GameType.UnitConstructionQueueType.Shipyard,
		requirements:[{
			hideDataWhenRequirementFailed: true,
			specificThingRequirement:{
				thingType: ThingType.Thing.Building,
				specificThingType: GameType.BuildingType.Shipyard,
				operator: RequirementType.RequirementOperator.GreaterOrEqual,
				value: 1,
				valueGetter: RequirementValueGetters.buildingLevel(GameType.BuildingType.Shipyard),},},],
		costMap: new Map<GameType.ResourceType, number>([
			[GameType.ResourceType.Metal, 2000],]),
		maxHealth: 2000,
	}],

	[GameType.UnitType.SolarSatellite, { displayName: "Solar Satellite",
		category: GameType.UnitCategory.Satellite,
		queueType: GameType.UnitConstructionQueueType.Shipyard,
		requirements:[{
			hideDataWhenRequirementFailed: true,
			specificThingRequirement:{
				thingType: ThingType.Thing.Building,
				specificThingType: GameType.BuildingType.Shipyard,
				operator: RequirementType.RequirementOperator.GreaterOrEqual,
				value: 1,
				valueGetter: RequirementValueGetters.buildingLevel(GameType.BuildingType.Shipyard),},},],
		costMap: new Map<GameType.ResourceType, number>([
			[GameType.ResourceType.Crystal, 2000],
			[GameType.ResourceType.Deuterium, 500],]),
		maxHealth: 2000,
		unitPlanetValueStats: [{
			unitPlanetValueProductionFormulasType: GameType.UnitPlanetValueProductionFormulasType.TemperatureScaled,
			basePlanetValueFactor: new Map<GameType.PlanetValueType, number>([
				[GameType.PlanetValueType.Energy, 1],]),
			temperatureOffset: 160,
			temperatureDivider: 6,}],
	}],

	[GameType.UnitType.InterplanetaryMissile, { displayName: "Interplanetary Missile",
		category: GameType.UnitCategory.Missile,
		queueType: GameType.UnitConstructionQueueType.MissileSilo,
		requirements:[
			{hideDataWhenRequirementFailed: true,
			specificThingRequirement:{
				thingType: ThingType.Thing.Building,
				specificThingType: GameType.BuildingType.MissileSilo,
				operator: RequirementType.RequirementOperator.GreaterOrEqual,
				value: 4,
				valueGetter: RequirementValueGetters.buildingLevel(GameType.BuildingType.MissileSilo),},},
			{hideDataWhenRequirementFailed: true,
			specificThingRequirement:{
				thingType: ThingType.Thing.Research,
				specificThingType: GameType.ResearchType.ImpulseDrive,
				operator: RequirementType.RequirementOperator.GreaterOrEqual,
				value: 1,
				valueGetter: RequirementValueGetters.researchLevel(GameType.ResearchType.ImpulseDrive),},},
			{hideDataWhenRequirementFailed: true,
			specificThingRequirement:{
				thingType: ThingType.Thing.PlanetValue,
				specificThingType: GameType.PlanetValueType.MissileSpace,
				operator: RequirementType.RequirementOperator.GreaterThan,
				value: 0,
				valueGetter: RequirementValueGetters.freeMissileSpace(),},},],
		costMap: new Map<GameType.ResourceType, number>([
			[GameType.ResourceType.Metal, 12500],
			[GameType.ResourceType.Crystal, 2500],
			[GameType.ResourceType.Deuterium, 10000],]),
		maxHealth: 15000,
		unitPlanetValueStats: [{
			unitPlanetValueProductionFormulasType: GameType.UnitPlanetValueProductionFormulasType.FixedPerUnit,
			basePlanetValueFactor: new Map<GameType.PlanetValueType, number>([
				[GameType.PlanetValueType.MissileSpace, -2],]),}],
	}],

	[GameType.UnitType.InterceptorMissile, { displayName: "Interceptor Missile",
		category: GameType.UnitCategory.Missile,
		queueType: GameType.UnitConstructionQueueType.MissileSilo,
		requirements:[{
			hideDataWhenRequirementFailed: true,
			specificThingRequirement:{
				thingType: ThingType.Thing.Building,
				specificThingType: GameType.BuildingType.MissileSilo,
				operator: RequirementType.RequirementOperator.GreaterOrEqual,
				value: 2,
				valueGetter: RequirementValueGetters.buildingLevel(GameType.BuildingType.MissileSilo),},},
			{hideDataWhenRequirementFailed: true,
			specificThingRequirement:{
				thingType: ThingType.Thing.PlanetValue,
				specificThingType: GameType.PlanetValueType.MissileSpace,
				operator: RequirementType.RequirementOperator.GreaterThan,
				value: 0,
				valueGetter: RequirementValueGetters.freeMissileSpace(),},},],
		costMap: new Map<GameType.ResourceType, number>([
			[GameType.ResourceType.Metal, 8000],
			[GameType.ResourceType.Deuterium, 2000],]),
		maxHealth: 8000,
		unitPlanetValueStats: [{
			unitPlanetValueProductionFormulasType: GameType.UnitPlanetValueProductionFormulasType.FixedPerUnit,
			basePlanetValueFactor: new Map<GameType.PlanetValueType, number>([
				[GameType.PlanetValueType.MissileSpace, -1],]),}],
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
		displayName: "Metal",}],
	[GameType.ResourceType.Crystal, {
		displayName: "Crystal",}],
	[GameType.ResourceType.Deuterium, {
		displayName: "Deuterium",}],
]);
//#endregion

//#region Fleet
// MAX_ALLOWED_PLANETS lives here (above its //#region Planet home) because FLEET_ACTION_INFOS is
// constructed at module load and references it as the Colonize planet-cap threshold.
export const MAX_ALLOWED_PLANETS: number = 9;

export const FLEET_ACTION_INFOS: ReadonlyMap<GameType.FleetActionType, GameType.FleetActionInfo> = new Map<GameType.FleetActionType, GameType.FleetActionInfo>
([
    [GameType.FleetActionType.Station, {
		displayName: "Station",
			requirements:[{
			hideDataWhenRequirementFailed: true,
			thingRequirement:{
				thingType: ThingType.Thing.FleetMovement,
				operator: RequirementType.RequirementOperator.Equal,
				value: true,
				valueGetter: RequirementValueGetters.doesTargetZoneExist(),},},],}],
	[GameType.FleetActionType.Collect, {
		displayName: "Collect",
			requirements:[{
			hideDataWhenRequirementFailed: true,
			thingRequirement:{
				thingType: ThingType.Thing.FleetMovement,
				operator: RequirementType.RequirementOperator.Equal,
				value: true,
				valueGetter: RequirementValueGetters.doesTargetZoneExist(),},},],}],
	[GameType.FleetActionType.Colonize, {
		displayName: "Colonize",
			requirements:[
			{
			hideDataWhenRequirementFailed: true,
			specificThingRequirement:{
				thingType: ThingType.Thing.FleetMovement,
				specificThingType: GameType.UnitType.ColonyShip,
				operator: RequirementType.RequirementOperator.GreaterOrEqual,
				value: 1,
				valueGetter: RequirementValueGetters.unitQuantities(GameType.UnitType.ColonyShip),},},
			{
			hideDataWhenRequirementFailed: true,
			thingRequirement:{
				thingType: ThingType.Thing.FleetMovement,
				operator: RequirementType.RequirementOperator.Equal,
				value: false,
				valueGetter: RequirementValueGetters.isZoneAssociatedPlanetOwned(),},},
			{
			hideDataWhenRequirementFailed: true,
			thingRequirement:{
				thingType: ThingType.Thing.FleetMovement,
				operator: RequirementType.RequirementOperator.Equal,
				value: GameType.PlanetZone.Planet,
				valueGetter: RequirementValueGetters.getTargetPlanetZone(),},},
			{
			hideDataWhenRequirementFailed: true,
			thingRequirement:{
				thingType: ThingType.Thing.FleetMovement,
				operator: RequirementType.RequirementOperator.LesserThan,
				value: MAX_ALLOWED_PLANETS,
				valueGetter: RequirementValueGetters.playerPlanetCount(),},},],}],
	[GameType.FleetActionType.Recycle, {
		displayName: "Recycle",
			requirements:[
			{
			hideDataWhenRequirementFailed: true,
			thingRequirement:{
				thingType: ThingType.Thing.FleetMovement,
				operator: RequirementType.RequirementOperator.Equal,
				value: GameType.PlanetZone.DebrisField,
				valueGetter: RequirementValueGetters.getTargetPlanetZone(),},},
			{
			hideDataWhenRequirementFailed: true,
			thingRequirement:{
				thingType: ThingType.Thing.FleetMovement,
				operator: RequirementType.RequirementOperator.Equal,
				value: true,
				valueGetter: RequirementValueGetters.allFleetUnitsCanTargetDebrisField(),},},
			{
			hideDataWhenRequirementFailed: true,
			thingRequirement:{
				thingType: ThingType.Thing.FleetMovement,
				operator: RequirementType.RequirementOperator.Equal,
				value: true,
				valueGetter: RequirementValueGetters.isZoneAssociatedPlanetOwned(),},},],}],
	[GameType.FleetActionType.Espionage, {
		displayName: "Espionage",
			requirements:[
			{
			hideDataWhenRequirementFailed: true,
			thingRequirement:{
				thingType: ThingType.Thing.FleetMovement,
				operator: RequirementType.RequirementOperator.Equal,
				value: true,
				valueGetter: RequirementValueGetters.doesTargetZoneExist(),},},
			{
			hideDataWhenRequirementFailed: true,
			specificThingRequirement:{
				thingType: ThingType.Thing.FleetMovement,
				specificThingType: GameType.UnitType.EspionageProbe,
				operator: RequirementType.RequirementOperator.GreaterOrEqual,
				value: 1,
				valueGetter: RequirementValueGetters.unitQuantities(GameType.UnitType.EspionageProbe),},},
			{
			hideDataWhenRequirementFailed: true,
			thingRequirement:{
				thingType: ThingType.Thing.FleetMovement,
				operator: RequirementType.RequirementOperator.Equal,
				value: true,
				valueGetter: RequirementValueGetters.allFleetUnitsCanSpy(),},},
			{
			hideDataWhenRequirementFailed: true,
			thingRequirement:{
				thingType: ThingType.Thing.FleetMovement,
				operator: RequirementType.RequirementOperator.Equal,
				value: true,
				valueGetter: RequirementValueGetters.isTargetPlanetZoneSpyable(),},},],}],
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
		displayName: "Fleet Slots",
		limitFleets: true,}],
]);
//#endregion

//#region Planet
export const PLANET_ZONE_INFOS: ReadonlyMap<GameType.PlanetZone, GameType.PlanetZoneInfo> = new Map<GameType.PlanetZone, GameType.PlanetZoneInfo>
([
    [GameType.PlanetZone.Planet, {
		displayName: "Planet",
		isSelectable: true,
		canProduceResources: true,
		canBeSpied: true,}],
	[GameType.PlanetZone.Moon, {
		displayName: "Moon",
		isSelectable: true,
		canProduceResources: false,
		canBeSpied: true,}],
	[GameType.PlanetZone.DebrisField, {
		displayName: "Debris Field",
		isSelectable: false,
		canProduceResources: false,
		canBeSpied: false,}],
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
export const MAX_PLANET_NAME_LENGTH: number = 16;
//#endregion

//#region Requirements
export const GLOBAL_REQUIREMENTS: Map<ThingType.Thing, RequirementType.Requirement[]> = new Map<ThingType.Thing, RequirementType.Requirement[]>
([
    [ThingType.Thing.BuildingUpgrade, [{
		hideDataWhenRequirementFailed: false,
		thingRequirement: {
			thingType: ThingType.Thing.BuildingUpgrade,
			operator: RequirementType.RequirementOperator.Equal,
			value: false,
			valueGetter: RequirementValueGetters.isAnyBuildingUpgradeInProgress(),}},
		{hideDataWhenRequirementFailed: false,
		thingRequirement: {
			thingType: ThingType.Thing.BuildingDeconstruction,
			operator: RequirementType.RequirementOperator.Equal,
			value: false,
			valueGetter: RequirementValueGetters.isAnyBuildingDeconstructionInProgress(),}},
		{hideDataWhenRequirementFailed: true,
		specificThingRequirement: {
			thingType: ThingType.Thing.PlanetValue,
			specificThingType: GameType.PlanetValueType.Size,
			operator: RequirementType.RequirementOperator.GreaterThan,
			value: 0,
			valueGetter: RequirementValueGetters.freeSize(),}}]],
	[ThingType.Thing.BuildingDeconstruction, [{
		hideDataWhenRequirementFailed: false,
		thingRequirement: {
			thingType: ThingType.Thing.BuildingUpgrade,
			operator: RequirementType.RequirementOperator.Equal,
			value: false,
			valueGetter: RequirementValueGetters.isAnyBuildingUpgradeInProgress(),}},
		{hideDataWhenRequirementFailed: false,
		thingRequirement: {
			thingType: ThingType.Thing.BuildingDeconstruction,
			operator: RequirementType.RequirementOperator.Equal,
			value: false,
			valueGetter: RequirementValueGetters.isAnyBuildingDeconstructionInProgress(),}}]],
	[ThingType.Thing.ResearchingResearch, [{
		hideDataWhenRequirementFailed: false,
		thingRequirement: {
			thingType: ThingType.Thing.ResearchingResearch,
			operator: RequirementType.RequirementOperator.Equal,
			value: false,
			valueGetter: RequirementValueGetters.isAnyResearchInProgress(),}},
		{hideDataWhenRequirementFailed: false,
		specificThingRequirement: {
			thingType: ThingType.Thing.Building,
			specificThingType: GameType.BuildingType.ResearchLab,
			operator: RequirementType.RequirementOperator.GreaterOrEqual,
			value: 1,
			valueGetter: RequirementValueGetters.buildingLevel(GameType.BuildingType.ResearchLab),}}]],
	[ThingType.Thing.FleetMovement, [{
		hideDataWhenRequirementFailed: false,
		thingRequirement: {
			thingType: ThingType.Thing.FleetMovement,
			operator: RequirementType.RequirementOperator.Equal,
			value: true,
			valueGetter: RequirementValueGetters.hasFreeFleetSlot(),}}]],
	[ThingType.Thing.UnitConstruction, [{
		hideDataWhenRequirementFailed: false,
		thingRequirement: {
			thingType: ThingType.Thing.BuildingUpgrade,
			operator: RequirementType.RequirementOperator.Equal,
			value: false,
			valueGetter: RequirementValueGetters.isSpecificBuildingBeingUpgraded(GameType.BuildingType.Shipyard),}},
		{hideDataWhenRequirementFailed: false,
		thingRequirement: {
			thingType: ThingType.Thing.BuildingUpgrade,
			operator: RequirementType.RequirementOperator.Equal,
			value: false,
			valueGetter: RequirementValueGetters.isSpecificBuildingBeingUpgraded(GameType.BuildingType.NaniteFactory),}}]],
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

		requirements:[{
			hideDataWhenRequirementFailed: true,
			specificThingRequirement:{
				thingType: ThingType.Thing.Research,
				specificThingType: GameType.ResearchType.EnergyTech,
				operator: RequirementType.RequirementOperator.GreaterOrEqual,
				value: 1,
				valueGetter: RequirementValueGetters.researchLevel(GameType.ResearchType.EnergyTech),},},],}],


    [GameType.ResearchType.ImpulseDrive, { displayName: "Impulse Drive",
		costFunctionType: GameType.ResearchCostFunctionType.SimpleExponential,
		costStats: {
			baseCostExponent: 2,
			baseCost: new Map<GameType.ResourceType, number>([
				[GameType.ResourceType.Metal, 2000],
				[GameType.ResourceType.Crystal, 4000],
				[GameType.ResourceType.Deuterium, 600],]),},

		requirements:[{
			hideDataWhenRequirementFailed: true,
			specificThingRequirement:{
				thingType: ThingType.Thing.Research,
				specificThingType: GameType.ResearchType.EnergyTech,
				operator: RequirementType.RequirementOperator.GreaterOrEqual,
				value: 1,
				valueGetter: RequirementValueGetters.researchLevel(GameType.ResearchType.EnergyTech),},},
			{hideDataWhenRequirementFailed: true,
			specificThingRequirement:{
				thingType: ThingType.Thing.Building,
				specificThingType: GameType.BuildingType.ResearchLab,
				operator: RequirementType.RequirementOperator.GreaterOrEqual,
				value: 2,
				valueGetter: RequirementValueGetters.buildingLevel(GameType.BuildingType.ResearchLab),},},],}],


    [GameType.ResearchType.HyperspaceDrive, { displayName: "Hyperspace Drive",
		costFunctionType: GameType.ResearchCostFunctionType.SimpleExponential,
		costStats: {
			baseCostExponent: 2,
			baseCost: new Map<GameType.ResourceType, number>([
				[GameType.ResourceType.Metal, 10000],
				[GameType.ResourceType.Crystal, 20000],
				[GameType.ResourceType.Deuterium, 6000],]),},

		requirements:[{
			hideDataWhenRequirementFailed: true,
			specificThingRequirement:{
				thingType: ThingType.Thing.Research,
				specificThingType: GameType.ResearchType.EnergyTech,
				operator: RequirementType.RequirementOperator.GreaterOrEqual,
				value: 5,
				valueGetter: RequirementValueGetters.researchLevel(GameType.ResearchType.EnergyTech),},},
			{hideDataWhenRequirementFailed: true,
			specificThingRequirement:{
				thingType: ThingType.Thing.Building,
				specificThingType: GameType.BuildingType.ResearchLab,
				operator: RequirementType.RequirementOperator.GreaterOrEqual,
				value: 7,
				valueGetter: RequirementValueGetters.buildingLevel(GameType.BuildingType.ResearchLab),},},],}],


    [GameType.ResearchType.ComputerTech, { displayName: "Computer Technology",
		costFunctionType: GameType.ResearchCostFunctionType.SimpleExponential,
		costStats: {
			baseCostExponent: 2,
			baseCost: new Map<GameType.ResourceType, number>([
				[GameType.ResourceType.Crystal, 400],
				[GameType.ResourceType.Deuterium, 600],]),},

		playerValueStats: [{
			playerValueProductionFormulasType: GameType.ResearchPlayerValueProductionFormulasType.ProportionalOneToOne,
			basePlayerValueFactor: new Map<GameType.PlayerValueType, number>([
				[GameType.PlayerValueType.FleetSlots, 1],]),}],}],


	[GameType.ResearchType.EspionageTech, { displayName: "Espionage Technology",
		costFunctionType: GameType.ResearchCostFunctionType.SimpleExponential,
		costStats: {
			baseCostExponent: 2,
			baseCost: new Map<GameType.ResourceType, number>([
				[GameType.ResourceType.Metal, 200],
				[GameType.ResourceType.Crystal, 1000],
				[GameType.ResourceType.Deuterium, 200],]),},

		requirements:[{
			hideDataWhenRequirementFailed: true,
			specificThingRequirement:{
				thingType: ThingType.Thing.Building,
				specificThingType: GameType.BuildingType.ResearchLab,
				operator: RequirementType.RequirementOperator.GreaterOrEqual,
				value: 3,
				valueGetter: RequirementValueGetters.buildingLevel(GameType.BuildingType.ResearchLab),},},],}],
]);

//#endregion