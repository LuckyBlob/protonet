// Helpers that read the THING_DEFINITIONS table (display names). Sits above StaticData and thingData;
// only higher-layer consumers (views, requirements, fleetData) use these, never the StaticData init chain.
// Enumerating specific things (getAllSpecificThings) lives in staticDataHelpers, a lower layer, so modules
// inside the StaticData init chain (buildingData, planetValueData) can use it without importing thingData.
import * as ThingType from "@/lib/gameplay/coreData/thing/thingTypes";
import * as ThingData from "@/lib/gameplay/coreData/thing/thingData";

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
