import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as StaticData from "@/lib/gameplay/coreData/static/staticData";
import * as ThingType from "@/lib/gameplay/coreData/thing/thingTypes";
import * as DBType from "@/lib/db/dbTypes";

export function getBuildingStats(buildingType: GameType.BuildingType): GameType.BuildingStats | undefined
{
    return StaticData.BUILDING_STATS.get(buildingType);
}

export function getShipStats(shipType: GameType.ShipType): GameType.ShipStats | undefined
{
    return StaticData.SHIP_STATS.get(shipType);
}

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

export function rollSizeForSlot(slot: number): number
{
	const range: GameType.SlotSizeRange = StaticData.SLOT_SIZE_RANGES[slot - 1];
	const span: number = range.max - range.min;
	const rolledSize: number = range.min + Math.floor(Math.random() * (span + 1));
	return rolledSize;
}

export function getDistance(origin: GameType.PlanetAddress, target: GameType.PlanetAddress): number
{
    const galaxyDifference: number = Math.abs(origin.galaxy - target.galaxy);
    if (galaxyDifference !== 0)
    {
        return galaxyDifference * StaticData.GALAXY_DISTANCE;
    }

    const systemDifference: number = Math.abs(origin.system - target.system);
    if (systemDifference !== 0)
    {
        return StaticData.SYSTEM_DISTANCE + systemDifference * StaticData.SYSTEM_DISTANCE_FACTOR;
    }

    const slotDifference: number = Math.abs(origin.slot - target.slot);
    if (slotDifference !== 0)
    {
        return StaticData.SLOT_DISTANCE + slotDifference * StaticData.SLOT_DISTANCE_FACTOR;
    }

    return 0;
}

export function isSameAddress(origin: GameType.PlanetAddress, target: GameType.PlanetAddress): boolean
{
    return (origin.galaxy === target.galaxy) && (origin.system === target.system) && (origin.slot === target.slot)
}

export function formatPlanetAddress(galaxy: number, system: number, slot: number): string
{
    return `[${galaxy}:${system}:${slot}]`;
}

export function getPlayerName(publicPlayerRows: DBType.PublicPlayerRow[], playerId: number | null): string
{
    if (playerId === null)
    {
        return "Unknown";
    }
    const matchingRow: DBType.PublicPlayerRow | undefined = publicPlayerRows.find((row: DBType.PublicPlayerRow): boolean => row.id === playerId);
    return matchingRow?.username ?? "Unknown";
}