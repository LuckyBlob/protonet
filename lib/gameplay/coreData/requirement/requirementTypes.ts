import * as ThingType from "@/lib/gameplay/coreData/thing/thingTypes";
import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";

export const RequirementOperator =
{
    GreaterThan: 1,
    GreaterOrEqual: 2,
    Equal: 3,
    LesserOrEqual: 4,
    LesserThan: 5,
} as const;
export type RequirementOperator = typeof RequirementOperator[keyof typeof RequirementOperator];

export type RequirementContext =
{
    playerData: CoreType.PlayerData;
    planetId: number;
    unitQuantities?: Map<GameType.UnitType, number>;
    transportedResourceQuantities?: Map<GameType.ResourceType, number>;
    targetPlanetAddress?: GameType.PlanetAddress;
    zoneAssociatedPlanetOwnerPlayerId?: number | null;
    targetZoneExists?: boolean;
};

export type RequirementValueGetter = (context: RequirementContext, requirement: Requirement) => number;
export type RequirementCondition = 
{
    valueGetter: RequirementValueGetter;
    failureDescription: string | ((requirement: Requirement, context: RequirementContext) => string);
};
export type Requirement =
{
    hideDataWhenRequirementFailed?: boolean;
    applicableZones?: GameType.PlanetZone[];
    thingType?: ThingType.Thing;
    specificThingType?: ThingType.SpecificThing;
    condition: RequirementCondition;
    operator: RequirementOperator;
    value: number | boolean | RequirementValueGetter;
};
