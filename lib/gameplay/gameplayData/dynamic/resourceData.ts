import * as PlayerDataType from "@/lib/gameplay/gameplayData/player/playerDataTypes";
import * as ThingTypes from "@/lib/gameplay/coreData/type/thingTypes";
import * as MathHelp from "@/lib/helper/mathHelp";

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

export function hasResourceQuantities(fullPlanetData: PlayerDataType.FullPlanetData, resourceQuantities: Map<number, number>): boolean
{
    return MathHelp.hasQuantities(resourceQuantities, (type: number): number | undefined => { return getResourceQuantity(fullPlanetData, type) });
}

export function subtractPlanetResources(fullPlanetData: PlayerDataType.FullPlanetData, resourceQuantities: Map<number, number>): Map<number, number>
{
    return MathHelp.subtractQuantities(resourceQuantities,
                                      (type: number): number | undefined => { return getResourceQuantity(fullPlanetData, type) },
                                      (type: number, value: number): void => { setResourceQuantity(fullPlanetData, type, value) });
}

export function subtractPlanetResource(fullPlanetData: PlayerDataType.FullPlanetData, resourceType: number, amountToSubtract: number): number
{
    return MathHelp.subtractQuantity(resourceType, amountToSubtract,
                                    (type: number): number | undefined => { return getResourceQuantity(fullPlanetData, type) },
                                    (type: number, value: number): void => { setResourceQuantity(fullPlanetData, type, value) });
}

export function addPlanetResources(fullPlanetData: PlayerDataType.FullPlanetData, resourceQuantities: Map<number, number>): Map<number, number>
{
    return MathHelp.addQuantities(resourceQuantities,
                                 (type: number): number | undefined => { return getResourceQuantity(fullPlanetData, type) },
                                 (type: number, value: number): void => { setResourceQuantity(fullPlanetData, type, value) });
}

export function addPlanetResource(fullPlanetData: PlayerDataType.FullPlanetData, resourceType: number, amountToSubtract: number): number
{
    return MathHelp.addQuantity(resourceType, amountToSubtract,
                               (type: number): number | undefined => { return getResourceQuantity(fullPlanetData, type) },
                               (type: number, value: number): void => { setResourceQuantity(fullPlanetData, type, value) });
}