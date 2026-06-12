import * as ThingType from "@/lib/gameplay/coreData/type/thingTypes";
import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as RequirementType from "@/lib/gameplay/coreData/requirement/requirementTypes";
import * as RequirementValueGetters from "@/lib/gameplay/coreData/requirement/requirementValueGetters";

type RequirementMap = Map<ThingType.Thing, ReadonlyMap<ThingType.SpecificThing, RequirementType.Requirement[]>>;

export const REQUIREMENT_MAP: RequirementMap = new Map
([
    [ThingType.Thing.BuildingUpgrade, new Map<ThingType.SpecificThing, RequirementType.Requirement[]>([
        [GameType.BuildingType.MetalMine, [{
            hideDataWhenRequirementFailed: false,
            thingRequirement:
            {
                thingType: ThingType.Thing.BuildingUpgrade,
                operator: RequirementType.RequirementOperator.Equal,
                value: false,
                valueGetter: RequirementValueGetters.isAnyBuildingUpgradeInProgress(),
            },
        }]],
        [GameType.BuildingType.CrystalGrower, [{
            hideDataWhenRequirementFailed: false,
            thingRequirement:
            {
                thingType: ThingType.Thing.BuildingUpgrade,
                operator: RequirementType.RequirementOperator.Equal,
                value: false,
                valueGetter: RequirementValueGetters.isAnyBuildingUpgradeInProgress(),
            },
        }]],
/*3*/   [GameType.BuildingType.Shipyard, [
            {
                hideDataWhenRequirementFailed: false,
                thingRequirement:
                {
                    thingType: ThingType.Thing.BuildingUpgrade,
                    operator: RequirementType.RequirementOperator.Equal,
                    value: false,
                    valueGetter: RequirementValueGetters.isAnyBuildingUpgradeInProgress(),
                },
            },
            {
                hideDataWhenRequirementFailed: true,
                specificThingRequirement:
                {
                    thingType: ThingType.Thing.Building,
                    specificThingType: GameType.BuildingType.RoboticFactory,
                    operator: RequirementType.RequirementOperator.GreaterOrEqual,
                    value: 2,
                    valueGetter: RequirementValueGetters.buildingLevel(GameType.BuildingType.RoboticFactory),
                },
            },
        ]],
/*4*/   [GameType.BuildingType.RoboticFactory, [{
            hideDataWhenRequirementFailed: false,
            thingRequirement:
            {
                thingType: ThingType.Thing.BuildingUpgrade,
                operator: RequirementType.RequirementOperator.Equal,
                value: false,
                valueGetter: RequirementValueGetters.isAnyBuildingUpgradeInProgress(),
            },
        }]],
/*5*/   [GameType.BuildingType.DeuteriumSynthesizer, [{
            hideDataWhenRequirementFailed: false,
            thingRequirement:
            {
                thingType: ThingType.Thing.BuildingUpgrade,
                operator: RequirementType.RequirementOperator.Equal,
                value: false,
                valueGetter: RequirementValueGetters.isAnyBuildingUpgradeInProgress(),
            },
        }]],
    ])],
    [ThingType.Thing.ShipConstruction, new Map<ThingType.SpecificThing, RequirementType.Requirement[]>([
        [GameType.ShipType.SmallTransport, [
            {
                hideDataWhenRequirementFailed: true,
                specificThingRequirement:
                {
                    thingType: ThingType.Thing.Building,
                    specificThingType: GameType.BuildingType.Shipyard,
                    operator: RequirementType.RequirementOperator.GreaterOrEqual,
                    value: 2,
                    valueGetter: RequirementValueGetters.buildingLevel(GameType.BuildingType.Shipyard),
                },
            },
            {
                hideDataWhenRequirementFailed: false,
                specificThingRequirement:
                {
                    thingType: ThingType.Thing.BuildingUpgrade,
                    specificThingType: GameType.BuildingType.Shipyard,
                    operator: RequirementType.RequirementOperator.Equal,
                    value: false,
                    valueGetter: RequirementValueGetters.isSpecificBuildingBeingUpgraded(GameType.BuildingType.Shipyard),
                },
            },
        ]],
        [GameType.ShipType.LargeTransport, [
            {
                hideDataWhenRequirementFailed: true,
                specificThingRequirement:
                {
                    thingType: ThingType.Thing.Building,
                    specificThingType: GameType.BuildingType.Shipyard,
                    operator: RequirementType.RequirementOperator.GreaterOrEqual,
                    value: 6,
                    valueGetter: RequirementValueGetters.buildingLevel(GameType.BuildingType.Shipyard),
                },
            },
            {
                hideDataWhenRequirementFailed: false,
                specificThingRequirement:
                {
                    thingType: ThingType.Thing.BuildingUpgrade,
                    specificThingType: GameType.BuildingType.Shipyard,
                    operator: RequirementType.RequirementOperator.Equal,
                    value: false,
                    valueGetter: RequirementValueGetters.isSpecificBuildingBeingUpgraded(GameType.BuildingType.Shipyard),
                },
            },
        ]],
        [GameType.ShipType.ColonyShip, [
            {
                hideDataWhenRequirementFailed: true,
                specificThingRequirement:
                {
                    thingType: ThingType.Thing.Building,
                    specificThingType: GameType.BuildingType.Shipyard,
                    operator: RequirementType.RequirementOperator.GreaterOrEqual,
                    value: 4,
                    valueGetter: RequirementValueGetters.buildingLevel(GameType.BuildingType.Shipyard),
                },
            },
        ]],
    ])],
]);
