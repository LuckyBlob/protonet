// Helpers that read game content (StaticData and the THING_DEFINITIONS table). Sits above StaticData;
// only higher-layer consumers (views, requirements, fleetData) use these, never the StaticData init chain.
import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as StaticData from "@/lib/gameplay/coreData/static/staticData";
import * as ThingType from "@/lib/gameplay/coreData/thing/thingTypes";
import * as ThingData from "@/lib/gameplay/coreData/thing/thingData";

export function getAllSpecificThings(thingType: typeof ThingType.Thing.Resource): GameType.ResourceType[];
export function getAllSpecificThings(thingType: typeof ThingType.Thing.Building): GameType.BuildingType[];
export function getAllSpecificThings(thingType: typeof ThingType.Thing.Ship): GameType.ShipType[];
export function getAllSpecificThings(thingType: typeof ThingType.Thing.PlanetValue): GameType.PlanetValueType[];
export function getAllSpecificThings(thingType: ThingType.Thing): ThingType.SpecificThing[];
export function getAllSpecificThings(thingType: ThingType.Thing): ThingType.SpecificThing[]
{
    switch (thingType)
    {
        case ThingType.Thing.Building:
        {
            return [...StaticData.BUILDING_STATS.keys()];
        }
        case ThingType.Thing.Ship:
        {
            return [...StaticData.SHIP_STATS.keys()];
        }
        case ThingType.Thing.Resource:
        {
            return [...StaticData.RESOURCE_INFOS.keys()];
        }
        case ThingType.Thing.PlanetValue:
        {
            return [...StaticData.PLANET_VALUE_INFOS.keys()];
        }
    }

    throw new Error(`getAllSpecificThings not supported for Thing ${thingType}`);
}

export function getSpecificThingNameMap(thingType: ThingType.Thing): ReadonlyMap<ThingType.SpecificThing, string>
{
    const thingDefinition: ThingType.ThingDefinition | undefined = ThingData.THING_DEFINITIONS.get(thingType);

    if (thingDefinition === undefined)
    {
        throw new Error(`UNREACHABLE: Invalid ThingType ${thingType}`);
    }

    return thingDefinition.specificThingDisplayNames;
}

export function getSpecificThingName(specificThing: ThingType.SpecificThingType): string
{
    const specificThingDisplayNameMap: ReadonlyMap<ThingType.SpecificThing, string> = getSpecificThingNameMap(specificThing.thingType);
    const specificThingDisplayName: string | undefined = specificThingDisplayNameMap.get(specificThing.specificThingType);
    if (specificThingDisplayName === undefined)
    {
        throw new Error(`UNREACHABLE: No name found for specific thing type ${specificThing.specificThingType} for thing ${specificThing.thingType}`);
    }
    return specificThingDisplayName;
}
