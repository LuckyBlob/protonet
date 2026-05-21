import * as ThingType from "@/lib/gameplay/coreData/type/thingTypes";
import * as PlayerDataType from "@/lib/gameplay/gameplayData/player/playerDataTypes";

export const RequirementOperator =
{
    GreaterThan: 1,
    GreaterOrEqual: 2,
    Equal: 3,
    LesserOrEqual: 4,
    LesserThan: 5,
} as const;
export type RequirementOperator = typeof RequirementOperator[keyof typeof RequirementOperator];

export type ThingValueGetter = (playerData: PlayerDataType.PlayerData, planetId: number) => number;

export type ThingRequirement =
{
    thingType: ThingType.Thing;
    operator: RequirementOperator;
    value: number | boolean;
    valueGetter: ThingValueGetter;
};

export type SpecificThingValueGetter = (playerData: PlayerDataType.PlayerData, planetId: number) => number;

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
