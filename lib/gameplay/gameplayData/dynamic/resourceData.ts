import * as PlayerDataType from "@/lib/gameplay/gameplayData/player/playerDataTypes";
import * as ThingTypes from "@/lib/gameplay/coreData/type/thingTypes";

// #region Resource Management
export function setResourceQuantity(fullPlanetData: PlayerDataType.FullPlanetData, resourceType: number, value: number): void
{
    ThingTypes.setSpecificThingValue(fullPlanetData, PlayerDataType.DataContext.ResourceQuantity, resourceType, value);
}

export function setResourceQuantities(fullPlanetData: PlayerDataType.FullPlanetData, resourceQuantities: Map<number, number>): void
{
    for (const [resourceType, resourceQuantity] of resourceQuantities)
    {
        setResourceQuantity(fullPlanetData, resourceType, resourceQuantity);
    }
}

export function getResourceQuantity(fullPlanetData: PlayerDataType.FullPlanetData, resourceType: number): number
{
    const resourceQuantities: Map<ThingTypes.SpecificThing, number> = ThingTypes.getThingValues(fullPlanetData, PlayerDataType.DataContext.ResourceQuantity);
    return resourceQuantities.get(resourceType) ?? 0;
}

export function getResourceQuantities(fullPlanetData: PlayerDataType.FullPlanetData): Map<number, number>
{
    const resourceQuantities: Map<number, number> = new Map<number, number>();
    const resourceTypes: number[] = ThingTypes.getAllSpecificThings(ThingTypes.Thing.Resource);
    for (const resourceType of resourceTypes)
    {
        resourceQuantities.set(resourceType, getResourceQuantity(fullPlanetData, resourceType));
    }

    return resourceQuantities;
}
//#endregion