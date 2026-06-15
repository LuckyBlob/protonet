// Helpers that operate only on the Thing taxonomy (no game content). Because these are used by lower-layer
// modules (buildingData, shipData, resourceData), this file must stay free of StaticData so it sits below it.
import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as ThingType from "@/lib/gameplay/coreData/thing/thingTypes";

export function resource(specificThing: ThingType.SpecificThing): ThingType.SpecificThingType { return { thingType: ThingType.Thing.Resource, specificThingType: specificThing }; }
export function building(specificThing: ThingType.SpecificThing): ThingType.SpecificThingType { return { thingType: ThingType.Thing.Building, specificThingType: specificThing }; }
export function ship(specificThing: ThingType.SpecificThing): ThingType.SpecificThingType { return { thingType: ThingType.Thing.Ship, specificThingType: specificThing }; }
export function fleetAction(specificThing: ThingType.SpecificThing): ThingType.SpecificThingType { return { thingType: ThingType.Thing.FleetMovement, specificThingType: specificThing }; }
export function planetValue(specificThing: ThingType.SpecificThing): ThingType.SpecificThingType { return { thingType: ThingType.Thing.PlanetValue, specificThingType: specificThing }; }

export function getThingValues(planetData: CoreType.PlanetData, dataContext: CoreType.DataContext): Map<ThingType.SpecificThing, number>
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

    return CoreType.getVariableFromContext(planetData.dynamicPlanetData, dataContext);
}

export function setSpecificThingValue(planetData: CoreType.PlanetData, dataContext: CoreType.DataContext, specificThing: ThingType.SpecificThing, value: number): void
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

    const specificThingValueMap: Map<ThingType.SpecificThing, number> = CoreType.getVariableFromContext(planetData.dynamicPlanetData, dataContext);

    specificThingValueMap.set(specificThing, value);
}
