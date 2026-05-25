export const GALAXY_COUNT: number = 2;
export const SYSTEM_COUNT: number = 20;
export const SLOT_COUNT: number = 5;

export const BUILDING_RESOURCE_PRODUCTION_1: number = 1; // prod resource 1
export const BUILDING_RESOURCE_PRODUCTION_2: number = 2; // prod resource 1
export const BUILDING_SHIPYARD: number = 3; // shipyard
export const BUILDING_ROBOTIC_FACTORY: number = 4; // Robotic factory
export const BUILDING_RESOURCE_PRODUCTION_3: number = 5; // prod resource 3

export const BUILDING_DISPLAY_NAMES: ReadonlyMap<number, string> = new Map<number, string>
([
    [BUILDING_RESOURCE_PRODUCTION_1, "Iron Mine"],
    [BUILDING_RESOURCE_PRODUCTION_2, "Crystal Mine"],
    [BUILDING_SHIPYARD, "Shipyard"],
    [BUILDING_ROBOTIC_FACTORY, "Robotics Factory"],
    [BUILDING_RESOURCE_PRODUCTION_3, "Deuterium Synthesizer"],
]);

export const RESOURCE_1: number = 1;
export const RESOURCE_2: number = 2;
export const RESOURCE_3: number = 3;

export const RESOURCE_DISPLAY_NAMES: ReadonlyMap<number, string> = new Map<number, string>
([
    [RESOURCE_1, "Iron"],
    [RESOURCE_2, "Crystal"],
    [RESOURCE_3, "Deuterium"],
]);

export const SMALL_TRANSPORT: number = 1;
export const LARGE_TRANSPORT: number = 2;
export const COLONY_SHIP: number = 3;

export const SHIP_DISPLAY_NAMES: ReadonlyMap<number, string> = new Map<number, string>
([
    [SMALL_TRANSPORT, "Small Transport"],
    [LARGE_TRANSPORT, "Large Transport"],
]);

export const FLEET_ACTION_STATION: number = 1; // Go to planet and stay there
export const FLEET_ACTION_TRANSPORT: number = 2; // Drop off resources and/or ships on target planet and go back to origin planet
export const FLEET_ACTION_COLONIZE: number = 3; // go to unclaimed planet and colonize it, turning it into a new planet owned by the player
export const FLEET_ACTION_COLLECT: number = 4; // go to planet, collect resources and/or ships, and go back to origin planet) - fails if there are enemy ships on the target planet

export const FLEET_ACTION_NAMES: ReadonlyMap<number, string> = new Map<number, string>
([
    [FLEET_ACTION_STATION, "Station"],
    [FLEET_ACTION_TRANSPORT, "Transport"],
    [FLEET_ACTION_COLONIZE, "Colonize"],
    [FLEET_ACTION_COLLECT, "Collect"],
]);

const GALAXY_DISTANCE: number = 20000;
const SYSTEM_DISTANCE: number = 2700;
const SYSTEM_DISTANCE_FACTOR: number = 95;
const SLOT_DISTANCE: number = 1000;
const SLOT_DISTANCE_FACTOR: number = 55;
export type PlanetAddress =
{
    galaxy: number,
    system: number,
    slot: number
}
export function getDistance(origin: PlanetAddress, target: PlanetAddress): number
{
    const galaxyDifference: number = Math.abs(origin.galaxy - target.galaxy);
    if (galaxyDifference !== 0)
    {
        return galaxyDifference * GALAXY_DISTANCE;
    }

    const systemDifference: number = Math.abs(origin.system - target.system);
    if (systemDifference !== 0)
    {
        return SYSTEM_DISTANCE + systemDifference * SYSTEM_DISTANCE_FACTOR;
    }

    const slotDifference: number = Math.abs(origin.slot - target.slot);
    if (slotDifference !== 0)
    {
        return SLOT_DISTANCE + slotDifference * SLOT_DISTANCE_FACTOR;
    }

    return 0;
}