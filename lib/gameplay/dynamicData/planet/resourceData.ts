import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as ThingTypes from "@/lib/gameplay/coreData/type/thingTypes";
import * as MathHelp from "@/lib/helper/mathHelp";

export function setResourceQuantity(planetData: CoreType.PlanetData, resourceType: number, value: number): void
{
    ThingTypes.setSpecificThingValue(planetData, CoreType.DataContext.ResourceQuantity, resourceType, value);
}

export function setResourceQuantities(planetData: CoreType.PlanetData, resourceQuantities: Map<number, number>): void
{
    for (const [resourceType, resourceQuantity] of resourceQuantities)
    {
        setResourceQuantity(planetData, resourceType, resourceQuantity);
    }
}

export function getResourceQuantity(planetData: CoreType.PlanetData, resourceType: number): number
{
    const resourceQuantities: Map<ThingTypes.SpecificThing, number> = ThingTypes.getThingValues(planetData, CoreType.DataContext.ResourceQuantity);
    return Math.floor(resourceQuantities.get(resourceType) ?? 0);
}

export function getResourceQuantities(planetData: CoreType.PlanetData): Map<number, number>
{
    const resourceQuantities: Map<number, number> = new Map<number, number>();
    const resourceTypes: ThingTypes.SpecificThing[] = ThingTypes.getAllSpecificThings(ThingTypes.Thing.Resource);
    for (const resourceType of resourceTypes)
    {
        resourceQuantities.set(resourceType, getResourceQuantity(planetData, resourceType));
    }

    return resourceQuantities;
}

export function hasResourceQuantities(planetData: CoreType.PlanetData, resourceQuantities: Map<number, number>): boolean
{
    return MathHelp.hasQuantities(resourceQuantities, (type: number): number | undefined => { return getResourceQuantity(planetData, type) });
}

export function subtractPlanetResources(planetData: CoreType.PlanetData, resourceQuantities: Map<number, number>): Map<number, number>
{
    return MathHelp.subtractQuantities(resourceQuantities,
                                      (type: number): number | undefined => { return getResourceQuantity(planetData, type) },
                                      (type: number, value: number): void => { setResourceQuantity(planetData, type, value) });
}

export function subtractPlanetResource(planetData: CoreType.PlanetData, resourceType: number, amountToSubtract: number): number
{
    return MathHelp.subtractQuantity(resourceType, amountToSubtract,
                                    (type: number): number | undefined => { return getResourceQuantity(planetData, type) },
                                    (type: number, value: number): void => { setResourceQuantity(planetData, type, value) });
}

export function addPlanetResources(planetData: CoreType.PlanetData, resourceQuantities: Map<number, number>): Map<number, number>
{
    return MathHelp.addQuantities(resourceQuantities,
                                 (type: number): number | undefined => { return getResourceQuantity(planetData, type) },
                                 (type: number, value: number): void => { setResourceQuantity(planetData, type, value) });
}

export function addPlanetResource(planetData: CoreType.PlanetData, resourceType: number, amountToSubtract: number): number
{
    return MathHelp.addQuantity(resourceType, amountToSubtract,
                               (type: number): number | undefined => { return getResourceQuantity(planetData, type) },
                               (type: number, value: number): void => { setResourceQuantity(planetData, type, value) });
}