import * as ThingType from "@/lib/gameplay/coreData/type/thingTypes";
import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as RequirementType from "@/lib/gameplay/coreData/requirement/requirementTypes";
import * as RequirementValueGetters from "@/lib/gameplay/coreData/requirement/requirementValueGetters";

type RequirementMap = Map<ThingType.Thing, ReadonlyMap<ThingType.SpecificThing, RequirementType.Requirement[]>>;

export const REQUIREMENT_MAP: RequirementMap = new Map
([
    [ThingType.Thing.BuildingUpgrade, new Map<ThingType.SpecificThing, RequirementType.Requirement[]>([
        [GameType.BUILDING_1, [{
            hideDataWhenRequirementFailed: false,
            thingRequirement:
            {
                thingType: ThingType.Thing.BuildingUpgrade,
                operator: RequirementType.RequirementOperator.Equal,
                value: false,
                valueGetter: RequirementValueGetters.isAnyBuildingUpgradeInProgress(),
            },
        }]],
        [GameType.BUILDING_2, [{
            hideDataWhenRequirementFailed: false,
            thingRequirement:
            {
                thingType: ThingType.Thing.BuildingUpgrade,
                operator: RequirementType.RequirementOperator.Equal,
                value: false,
                valueGetter: RequirementValueGetters.isAnyBuildingUpgradeInProgress(),
            },
        }]],
/*3*/   [GameType.SHIPYARD_BUILDING_TYPE, [
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
                    specificThingType: GameType.ROBOTIC_FACTORY_TYPE,
                    operator: RequirementType.RequirementOperator.GreaterOrEqual,
                    value: 2,
                    valueGetter: RequirementValueGetters.buildingLevel(GameType.ROBOTIC_FACTORY_TYPE),
                },
            },
        ]],
/*4*/   [GameType.ROBOTIC_FACTORY_TYPE, [{
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
    [ThingType.Thing.ShipBatchConstruction, new Map<ThingType.SpecificThing, RequirementType.Requirement[]>([
        [GameType.SMALL_TRANSPORT, [
            {
                hideDataWhenRequirementFailed: true,
                specificThingRequirement:
                {
                    thingType: ThingType.Thing.Building,
                    specificThingType: GameType.BUILDING_3,
                    operator: RequirementType.RequirementOperator.GreaterOrEqual,
                    value: 2,
                    valueGetter: RequirementValueGetters.buildingLevel(GameType.BUILDING_3),
                },
            },
            {
                hideDataWhenRequirementFailed: false,
                specificThingRequirement:
                {
                    thingType: ThingType.Thing.BuildingUpgrade,
                    specificThingType: GameType.BUILDING_3,
                    operator: RequirementType.RequirementOperator.Equal,
                    value: false,
                    valueGetter: RequirementValueGetters.isSpecificBuildingBeingUpgraded(GameType.BUILDING_3),
                },
            },
        ]],
        [GameType.LARGE_TRANSPORT, [
            {
                hideDataWhenRequirementFailed: true,
                specificThingRequirement:
                {
                    thingType: ThingType.Thing.Building,
                    specificThingType: GameType.BUILDING_3,
                    operator: RequirementType.RequirementOperator.GreaterOrEqual,
                    value: 6,
                    valueGetter: RequirementValueGetters.buildingLevel(GameType.BUILDING_3),
                },
            },
            {
                hideDataWhenRequirementFailed: false,
                specificThingRequirement:
                {
                    thingType: ThingType.Thing.BuildingUpgrade,
                    specificThingType: GameType.BUILDING_3,
                    operator: RequirementType.RequirementOperator.Equal,
                    value: false,
                    valueGetter: RequirementValueGetters.isSpecificBuildingBeingUpgraded(GameType.BUILDING_3),
                },
            },
        ]],
    ])],
]);
