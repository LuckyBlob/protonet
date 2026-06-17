// Helpers that operate only on the Thing taxonomy (no game content). Because these are used by lower-layer
// modules (buildingData, shipData, resourceData, researchData), this file must stay free of StaticData so it sits below it.
// The value getters/setters are generic over both data levels: planet contexts read planetData.dynamicPlanetData,
// player contexts read playerData.dynamicPlayerData. Each caller passes only the side its context lives on (the
// other is null), and we dispatch on the context.
import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as ThingType from "@/lib/gameplay/coreData/thing/thingTypes";

export function resource(specificThing: ThingType.SpecificThing): ThingType.SpecificThingType { return { thingType: ThingType.Thing.Resource, specificThingType: specificThing }; }
export function building(specificThing: ThingType.SpecificThing): ThingType.SpecificThingType { return { thingType: ThingType.Thing.Building, specificThingType: specificThing }; }
export function ship(specificThing: ThingType.SpecificThing): ThingType.SpecificThingType { return { thingType: ThingType.Thing.Ship, specificThingType: specificThing }; }
export function fleetAction(specificThing: ThingType.SpecificThing): ThingType.SpecificThingType { return { thingType: ThingType.Thing.FleetMovement, specificThingType: specificThing }; }
export function planetValue(specificThing: ThingType.SpecificThing): ThingType.SpecificThingType { return { thingType: ThingType.Thing.PlanetValue, specificThingType: specificThing }; }
export function research(specificThing: ThingType.SpecificThing): ThingType.SpecificThingType { return { thingType: ThingType.Thing.Research, specificThingType: specificThing }; }

export function getThingValues(playerData: CoreType.PlayerData | null, planetData: CoreType.PlanetData | null, dataContext: CoreType.DataContext): Map<ThingType.SpecificThing, number>
{
    if (dataContext === CoreType.DataContext.ShipConstruction)
    {
        throw new Error("ShipConstruction context does not have specific things that have a value... yet.");
    }

    if (dataContext === CoreType.DataContext.FutureFleetArrivals)
    {
        throw new Error("FutureFleetArrivals context does not have specific things that have a value... yet.");
    }

    if (dataContext === CoreType.DataContext.BuildingUpgrade)
    {
        throw new Error("BuildingUpgrade context does not have specific things that have a value... yet.");
    }

    if (dataContext === CoreType.DataContext.Messages)
    {
        throw new Error("Messages context does not have specific things that have a value.");
    }

    if (dataContext === CoreType.DataContext.CurrentlyResearching)
    {
        throw new Error("CurrentlyResearching context does not have specific things that have a value... yet.");
    }

    if (CoreType.isPlayerDataContext(dataContext))
    {
        if (playerData === null)
        {
            throw new Error(`getThingValues requires playerData for player data context ${dataContext}.`);
        }

        return CoreType.getPlayerVariableFromContext(playerData.dynamicPlayerData, dataContext);
    }

    if (planetData === null)
    {
        throw new Error(`getThingValues requires planetData for planet data context ${dataContext}.`);
    }

    return CoreType.getVariableFromContext(planetData.dynamicPlanetData, dataContext);
}

export function setSpecificThingValue(playerData: CoreType.PlayerData | null, planetData: CoreType.PlanetData | null, dataContext: CoreType.DataContext, specificThing: ThingType.SpecificThing, value: number): void
{
    if (dataContext === CoreType.DataContext.ShipConstruction)
    {
        throw new Error("ShipConstruction context is not supported for type setters since it doesnt have specific things.");
    }

    if (dataContext === CoreType.DataContext.FutureFleetArrivals)
    {
        throw new Error("FutureFleetArrivals context is not supported for type setters since it doesnt have specific things.");
    }

    if (dataContext === CoreType.DataContext.BuildingUpgrade)
    {
        throw new Error("BuildingUpgrade context is not supported for type setters since it doesnt have specific things.");
    }

    if (dataContext === CoreType.DataContext.Messages)
    {
        throw new Error("Messages context is not supported for type setters since it doesnt have specific things.");
    }

    if (dataContext === CoreType.DataContext.CurrentlyResearching)
    {
        throw new Error("CurrentlyResearching context is not supported for type setters since it doesnt have specific things.");
    }

    if (CoreType.isPlayerDataContext(dataContext))
    {
        if (playerData === null)
        {
            throw new Error(`setSpecificThingValue requires playerData for player data context ${dataContext}.`);
        }

        const playerSpecificThingValueMap: Map<ThingType.SpecificThing, number> = CoreType.getPlayerVariableFromContext(playerData.dynamicPlayerData, dataContext);
        playerSpecificThingValueMap.set(specificThing, value);
        return;
    }

    if (planetData === null)
    {
        throw new Error(`setSpecificThingValue requires planetData for planet data context ${dataContext}.`);
    }

    const specificThingValueMap: Map<ThingType.SpecificThing, number> = CoreType.getVariableFromContext(planetData.dynamicPlanetData, dataContext);
    specificThingValueMap.set(specificThing, value);
}
