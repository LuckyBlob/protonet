import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as ThingHelpers from "@/lib/gameplay/coreData/thing/thingHelpers";
import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as StaticData from "@/lib/gameplay/coreData/static/staticData";
import * as MathHelp from "@/lib/helper/mathHelp";

export function setResourceQuantity(planetData: CoreType.PlanetData, resourceType: GameType.ResourceType, value: number): void
{
    ThingHelpers.setSpecificThingValue(planetData, CoreType.DataContext.ResourceQuantity, resourceType, value);
}

export function setResourceQuantities(planetData: CoreType.PlanetData, resourceQuantities: Map<GameType.ResourceType, number>): void
{
    for (const [resourceType, resourceQuantity] of resourceQuantities)
    {
        setResourceQuantity(planetData, resourceType, resourceQuantity);
    }
}

export function getResourceQuantity(planetData: CoreType.PlanetData, resourceType: GameType.ResourceType): number
{
    const resourceQuantities: Map<GameType.ResourceType, number> = ThingHelpers.getThingValues(planetData, CoreType.DataContext.ResourceQuantity) as Map<GameType.ResourceType, number>;
    return Math.floor(resourceQuantities.get(resourceType) ?? 0);
}

export function getResourceQuantities(planetData: CoreType.PlanetData): Map<GameType.ResourceType, number>
{
    const resourceQuantities: Map<GameType.ResourceType, number> = new Map<GameType.ResourceType, number>();
    for (const resourceType of StaticData.RESOURCE_INFOS.keys())
    {
        resourceQuantities.set(resourceType, getResourceQuantity(planetData, resourceType));
    }

    return resourceQuantities;
}

export function hasResourceQuantities(planetData: CoreType.PlanetData, resourceQuantities: Map<GameType.ResourceType, number>): boolean
{
    return MathHelp.hasQuantities(resourceQuantities, (type: GameType.ResourceType): number | undefined => { return getResourceQuantity(planetData, type) });
}

export function subtractPlanetResources(planetData: CoreType.PlanetData, resourceQuantities: Map<GameType.ResourceType, number>): Map<GameType.ResourceType, number>
{
    return MathHelp.subtractQuantities(resourceQuantities,
                                      (type: GameType.ResourceType): number | undefined => { return getResourceQuantity(planetData, type) },
                                      (type: GameType.ResourceType, value: number): void => { setResourceQuantity(planetData, type, value) });
}

export function subtractPlanetResource(planetData: CoreType.PlanetData, resourceType: GameType.ResourceType, amountToSubtract: number): number
{
    return MathHelp.subtractQuantity(resourceType, amountToSubtract,
                                    (type: GameType.ResourceType): number | undefined => { return getResourceQuantity(planetData, type) },
                                    (type: GameType.ResourceType, value: number): void => { setResourceQuantity(planetData, type, value) });
}

export function addPlanetResources(planetData: CoreType.PlanetData, resourceQuantities: Map<GameType.ResourceType, number>): Map<GameType.ResourceType, number>
{
    return MathHelp.addQuantities(resourceQuantities,
                                 (type: GameType.ResourceType): number | undefined => { return getResourceQuantity(planetData, type) },
                                 (type: GameType.ResourceType, value: number): void => { setResourceQuantity(planetData, type, value) });
}

export function addPlanetResource(planetData: CoreType.PlanetData, resourceType: GameType.ResourceType, amountToSubtract: number): number
{
    return MathHelp.addQuantity(resourceType, amountToSubtract,
                               (type: GameType.ResourceType): number | undefined => { return getResourceQuantity(planetData, type) },
                               (type: GameType.ResourceType, value: number): void => { setResourceQuantity(planetData, type, value) });
}
