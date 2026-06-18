import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as ThingType from "@/lib/gameplay/coreData/thing/thingTypes";
import * as RequirementType from "@/lib/gameplay/coreData/requirement/requirementTypes";
import * as RequirementValueGetters from "@/lib/gameplay/coreData/requirement/requirementValueGetters";

//#region Buildings
export const BUILDING_STATS: ReadonlyMap<GameType.BuildingType, GameType.BuildingStats> = new Map<GameType.BuildingType, GameType.BuildingStats>
([
    [GameType.BuildingType.MetalMine, { displayName: "Metal Mine",
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
		costFunctionType: GameType.BuildingCostFunctionType.SimpleExponential,
		costStats: {
			baseCostExponent: 2,
			baseCost: new Map<GameType.ResourceType, number>([
				[GameType.ResourceType.Metal, 225],
				[GameType.ResourceType.Crystal, 75],]),},

		productionFunctionType: GameType.ProductionFunctionType.SimpleProductionBuilding,
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
		requirements:[{
			hideDataWhenRequirementFailed: true,
			specificThingRequirement:{
				thingType: ThingType.Thing.Building,
				specificThingType: GameType.BuildingType.RoboticFactory,
				operator: RequirementType.RequirementOperator.GreaterOrEqual,
				value: 2,
				valueGetter: RequirementValueGetters.buildingLevel(GameType.BuildingType.RoboticFactory),},},],
		costFunctionType: GameType.BuildingCostFunctionType.SimpleExponential,
		costStats: {
			baseCostExponent: 2,
			baseCost: new Map<GameType.ResourceType, number>([
				[GameType.ResourceType.Metal, 400],
				[GameType.ResourceType.Crystal, 200],
				[GameType.ResourceType.Deuterium, 100],]),},
	},],


	[GameType.BuildingType.RoboticFactory, { displayName: "Robotic Factory",
		costFunctionType: GameType.BuildingCostFunctionType.SimpleExponential,
		costStats: {
			baseCostExponent: 1.5,
			baseCost: new Map<GameType.ResourceType, number>([
				[GameType.ResourceType.Metal, 400],
				[GameType.ResourceType.Crystal, 120],
				[GameType.ResourceType.Deuterium, 200],]),},
	},],

	[GameType.BuildingType.ResearchLab, { displayName: "Research Lab",
		costFunctionType: GameType.BuildingCostFunctionType.SimpleExponential,
		costStats: {
			baseCostExponent: 2,
			baseCost: new Map<GameType.ResourceType, number>([
				[GameType.ResourceType.Metal, 200],
				[GameType.ResourceType.Crystal, 400],
				[GameType.ResourceType.Deuterium, 200],]),},
	},],

	[GameType.BuildingType.NaniteFactory, { displayName: "Nanite Factory",
		requirements:[{
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
				valueGetter: RequirementValueGetters.researchLevel(GameType.ResearchType.ComputerTech),},},],
		costFunctionType: GameType.BuildingCostFunctionType.SimpleExponential,
		costStats: {
			baseCostExponent: 2,
			baseCost: new Map<GameType.ResourceType, number>([
				[GameType.ResourceType.Metal, 1000000],
				[GameType.ResourceType.Crystal, 500000],
				[GameType.ResourceType.Deuterium, 100000],]),},
	},],
]);
//#endregion

//#region Ships
export const SHIP_STATS: ReadonlyMap<GameType.ShipType, GameType.ShipStats> = new Map<GameType.ShipType, GameType.ShipStats>
([
    [GameType.ShipType.SmallTransport, { displayName: "Small Transport",
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


    [GameType.ShipType.LargeTransport, { displayName: "Large Transport",
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


    [GameType.ShipType.ColonyShip, { displayName: "Colony Ship",
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
		space: 2500,
		speed:  [
			{ engineTech: GameType.ResearchType.ImpulseDrive, researchLevel: 0, value: 7500}],
		baseFuelConsumption: [
			{ engineTech: GameType.ResearchType.ImpulseDrive, researchLevel: 0, value: new Map<GameType.ResourceType, number>([[GameType.ResourceType.Deuterium, 1000]])},],
	}],
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
				valueGetter: RequirementValueGetters.isTargetPlanetOwned(),},},],}],
	[GameType.FleetActionType.Collect, {
		displayName: "Collect",
			requirements:[{
			hideDataWhenRequirementFailed: true,
			thingRequirement:{
				thingType: ThingType.Thing.FleetMovement,
				operator: RequirementType.RequirementOperator.Equal,
				value: true,
				valueGetter: RequirementValueGetters.isTargetPlanetOwned(),},},],}],
	[GameType.FleetActionType.Colonize, {
		displayName: "Colonize",
			requirements:[
			{
			hideDataWhenRequirementFailed: true,
			specificThingRequirement:{
				thingType: ThingType.Thing.FleetMovement,
				specificThingType: GameType.ShipType.ColonyShip,
				operator: RequirementType.RequirementOperator.GreaterOrEqual,
				value: 1,
				valueGetter: RequirementValueGetters.shipQuantities(GameType.ShipType.ColonyShip),},},
			{
			hideDataWhenRequirementFailed: true,
			thingRequirement:{
				thingType: ThingType.Thing.FleetMovement,
				operator: RequirementType.RequirementOperator.Equal,
				value: false,
				valueGetter: RequirementValueGetters.isTargetPlanetOwned(),},},
			{
			hideDataWhenRequirementFailed: true,
			thingRequirement:{
				thingType: ThingType.Thing.FleetMovement,
				operator: RequirementType.RequirementOperator.LesserThan,
				value: MAX_ALLOWED_PLANETS,
				valueGetter: RequirementValueGetters.playerPlanetCount(),},},],}],
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
export const GALAXY_DISTANCE: number = 20000;
export const SYSTEM_DISTANCE: number = 2700;
export const SYSTEM_DISTANCE_FACTOR: number = 95;
export const SLOT_DISTANCE: number = 1000;
export const SLOT_DISTANCE_FACTOR: number = 55;

export const GALAXY_COUNT: number = 2;

export const SYSTEM_COUNT: number = 20;
export const SLOT_COUNT: number = 5;
export const MIN_SLOT_STARTING_PLANET: number = 3;
export const MAX_SLOT_STARTING_PLANET: number = 4;
export const STARTING_PLANET_SIZE: number = 163;
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
			valueGetter: RequirementValueGetters.isAnyBuildingUpgradeInProgress(),}}]],
	[ThingType.Thing.ShipConstruction, [{
		hideDataWhenRequirementFailed: false,
		thingRequirement: {
			thingType: ThingType.Thing.BuildingUpgrade,
			operator: RequirementType.RequirementOperator.Equal,
			value: false,
			valueGetter: RequirementValueGetters.isSpecificBuildingBeingUpgraded(GameType.BuildingType.Shipyard),}}]],
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
				[GameType.ResourceType.Crystal, 600],]),},

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
				[GameType.ResourceType.Crystal, 600],]),},

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
				[GameType.ResourceType.Crystal, 6000],]),},

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
]);

//#endregion