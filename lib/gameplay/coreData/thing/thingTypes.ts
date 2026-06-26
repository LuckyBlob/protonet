// The Thing taxonomy: the enum and its type shapes. No game content, no functions — pure vocabulary.
// This is the base of the thing layer; everything else in the folder builds on it.
import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";

export type SpecificThing = number;

export const Thing =
{
    Resource: 1,
    Building: 2,
    Unit: 3,
    BuildingUpgrade: 4,
    UnitConstruction: 5,
    FleetMovement: 6,
    PlanetValue: 7,
    Research: 8,
    ResearchingResearch: 9,
    PlayerValue: 10,
    BuildingDeconstruction: 11,
} as const;
export type Thing = typeof Thing[keyof typeof Thing];

export type SpecificThingType =
{
    thingType: Thing;
    specificThingType: SpecificThing;
};

export type ThingDefinition =
{
    specificThingDisplayNames: ReadonlyMap<SpecificThing, string>;
    contexts: CoreType.DataContext[];
};
