import * as ThingType from "@/lib/gameplay/coreData/type/thingTypes";
import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as RequirementType from "@/lib/gameplay/coreData/requirement/requirementTypes";
import * as RequirementValueGetters from "@/lib/gameplay/coreData/requirement/requirementValueGetters";

type RequirementMap = Map<ThingType.Thing, ReadonlyMap<ThingType.SpecificThing, RequirementType.Requirement[]>>;

export const REQUIREMENT_MAP: RequirementMap = new Map
([
    [ThingType.Thing.BuildingUpgrade, new Map<ThingType.SpecificThing, RequirementType.Requirement[]>([
        [GameType.BUILDING_RESOURCE_PRODUCTION_1, [{
            hideDataWhenRequirementFailed: false,
            thingRequirement:
            {
                thingType: ThingType.Thing.BuildingUpgrade,
                operator: RequirementType.RequirementOperator.Equal,
                value: false,
                valueGetter: RequirementValueGetters.isAnyBuildingUpgradeInProgress(),
            },
        }]],
        [GameType.BUILDING_RESOURCE_PRODUCTION_2, [{
            hideDataWhenRequirementFailed: false,
            thingRequirement:
            {
                thingType: ThingType.Thing.BuildingUpgrade,
                operator: RequirementType.RequirementOperator.Equal,
                value: false,
                valueGetter: RequirementValueGetters.isAnyBuildingUpgradeInProgress(),
            },
        }]],
/*3*/   [GameType.BUILDING_SHIPYARD, [
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
                    specificThingType: GameType.BUILDING_ROBOTIC_FACTORY,
                    operator: RequirementType.RequirementOperator.GreaterOrEqual,
                    value: 2,
                    valueGetter: RequirementValueGetters.buildingLevel(GameType.BUILDING_ROBOTIC_FACTORY),
                },
            },
        ]],
/*4*/   [GameType.BUILDING_ROBOTIC_FACTORY, [{
            hideDataWhenRequirementFailed: false,
            thingRequirement:
            {
                thingType: ThingType.Thing.BuildingUpgrade,
                operator: RequirementType.RequirementOperator.Equal,
                value: false,
                valueGetter: RequirementValueGetters.isAnyBuildingUpgradeInProgress(),
            },
        }]],
/*5*/   [GameType.BUILDING_RESOURCE_PRODUCTION_3, [{
            hideDataWhenRequirementFailed: false,
            thingRequirement:
            {
                thingType: ThingType.Thing.BuildingUpgrade,
                operator: RequirementType.RequirementOperator.Equal,
                value: false,
                valueGetter: RequirementValueGetters.isAnyBuildingUpgradeInProgress(),
            },
        }]],
/*6*/   [GameType.BUILDING_PLANET_VALUE_PRODUCTION_1, [{
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
        [GameType.SMALL_TRANSPORT, [
            {
                hideDataWhenRequirementFailed: true,
                specificThingRequirement:
                {
                    thingType: ThingType.Thing.Building,
                    specificThingType: GameType.BUILDING_SHIPYARD,
                    operator: RequirementType.RequirementOperator.GreaterOrEqual,
                    value: 2,
                    valueGetter: RequirementValueGetters.buildingLevel(GameType.BUILDING_SHIPYARD),
                },
            },
            {
                hideDataWhenRequirementFailed: false,
                specificThingRequirement:
                {
                    thingType: ThingType.Thing.BuildingUpgrade,
                    specificThingType: GameType.BUILDING_SHIPYARD,
                    operator: RequirementType.RequirementOperator.Equal,
                    value: false,
                    valueGetter: RequirementValueGetters.isSpecificBuildingBeingUpgraded(GameType.BUILDING_SHIPYARD),
                },
            },
        ]],
        [GameType.LARGE_TRANSPORT, [
            {
                hideDataWhenRequirementFailed: true,
                specificThingRequirement:
                {
                    thingType: ThingType.Thing.Building,
                    specificThingType: GameType.BUILDING_SHIPYARD,
                    operator: RequirementType.RequirementOperator.GreaterOrEqual,
                    value: 6,
                    valueGetter: RequirementValueGetters.buildingLevel(GameType.BUILDING_SHIPYARD),
                },
            },
            {
                hideDataWhenRequirementFailed: false,
                specificThingRequirement:
                {
                    thingType: ThingType.Thing.BuildingUpgrade,
                    specificThingType: GameType.BUILDING_SHIPYARD,
                    operator: RequirementType.RequirementOperator.Equal,
                    value: false,
                    valueGetter: RequirementValueGetters.isSpecificBuildingBeingUpgraded(GameType.BUILDING_SHIPYARD),
                },
            },
        ]],
        [GameType.COLONY_SHIP, [
            {
                hideDataWhenRequirementFailed: true,
                specificThingRequirement:
                {
                    thingType: ThingType.Thing.Building,
                    specificThingType: GameType.BUILDING_SHIPYARD,
                    operator: RequirementType.RequirementOperator.GreaterOrEqual,
                    value: 4,
                    valueGetter: RequirementValueGetters.buildingLevel(GameType.BUILDING_SHIPYARD),
                },
            },
        ]],
    ])],
]);
