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

export type PotentialFleetAction =
{
};

export type RequirementContext =
{
    playerData: CoreType.PlayerData;
    planetId: number;
    shipQuantities?: Map<GameType.ShipType, number>;
    transportedResourceQuantities?: Map<GameType.ResourceType, number>;
    targetPlanetAddress?: GameType.PlanetAddress;
    zoneAssociatedPlanetOwnerPlayerId?: number | null;
    targetZoneExists?: boolean;
};

export type ThingValueGetter = (context: RequirementContext) => number;

export type ThingRequirement =
{
    thingType: ThingType.Thing;
    operator: RequirementOperator;
    value: number | boolean;
    valueGetter: ThingValueGetter;
};

export type SpecificThingValueGetter = (context: RequirementContext) => number;

export type SpecificThingRequirement =
{
    thingType: ThingType.Thing;
    specificThingType: ThingType.SpecificThing;
    operator: RequirementOperator;
    value: number | boolean;
    valueGetter: SpecificThingValueGetter;
};

export type Requirement =
{
    hideDataWhenRequirementFailed: boolean;
    thingRequirement?: ThingRequirement;
    specificThingRequirement?: SpecificThingRequirement;
};
