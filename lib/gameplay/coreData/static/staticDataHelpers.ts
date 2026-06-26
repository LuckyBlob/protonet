import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as StaticData from "@/lib/gameplay/coreData/static/staticData";
import * as ThingType from "@/lib/gameplay/coreData/thing/thingTypes";
import * as DBType from "@/lib/db/dbTypes";
import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";

export function getBuildingStats(buildingType: GameType.BuildingType): GameType.BuildingStats
{
    const buildingStats: GameType.BuildingStats | undefined = StaticData.BUILDING_STATS.get(buildingType);
    if (buildingStats === undefined)
    {
        throw new Error(`No BuildingStats for buildingType ${buildingType}.`);
    }

    return buildingStats;
}

export function canDeconstructBuilding(buildingType: GameType.BuildingType): boolean
{
    return getBuildingStats(buildingType).canDeconstruct !== false;
}

export function getShipStats(shipType: GameType.ShipType): GameType.ShipStats
{
    const shipStats: GameType.ShipStats | undefined = StaticData.SHIP_STATS.get(shipType);
    if (shipStats === undefined)
    {
        throw new Error(`No ShipStats for shipType ${shipType}.`);
    }

    return shipStats;
}

export function canShipTargetDebrisField(shipType: GameType.ShipType): boolean
{
    return getShipStats(shipType).canTargetDebrisField === true;
}

export function canShipSpy(shipType: GameType.ShipType): boolean
{
    return getShipStats(shipType).canSpy === true;
}

export function canPlanetZoneBeSpied(zone: GameType.PlanetZone): boolean
{
    return getPlanetZoneInfo(zone).canBeSpied === true;
}

export function getResearchInfo(researchType: GameType.ResearchType): GameType.ResearchInfo
{
    const researchInfo: GameType.ResearchInfo | undefined = StaticData.REASEARCH_INFO.get(researchType);
    if (researchInfo === undefined)
    {
        throw new Error(`No ResearchInfo for researchType ${researchType}.`);
    }

    return researchInfo;
}

export function getFleetActionInfo(fleetActionType: GameType.FleetActionType): GameType.FleetActionInfo
{
    const fleetActionInfo: GameType.FleetActionInfo | undefined = StaticData.FLEET_ACTION_INFOS.get(fleetActionType);
    if (fleetActionInfo === undefined)
    {
        throw new Error(`No FleetActionInfo for fleetActionType ${fleetActionType}.`);
    }

    return fleetActionInfo;
}

export function getPlanetZoneInfo(zone: GameType.PlanetZone): GameType.PlanetZoneInfo
{
    const planetZoneInfo: GameType.PlanetZoneInfo | undefined = StaticData.PLANET_ZONE_INFOS.get(zone);
    if (planetZoneInfo === undefined)
    {
        throw new Error(`No PlanetZoneInfo for zone ${zone}.`);
    }

    return planetZoneInfo;
}

export function getSelectableZones(planetDatas: CoreType.PlanetData[]): CoreType.PlanetData[]
{
    return planetDatas.filter((planetData: CoreType.PlanetData): boolean =>
    {
        return getPlanetZoneInfo(planetData.planetRow.zone as GameType.PlanetZone).isSelectable;
    });
}

export function getAllSpecificThings(thingType: typeof ThingType.Thing.Resource): GameType.ResourceType[];
export function getAllSpecificThings(thingType: typeof ThingType.Thing.Building): GameType.BuildingType[];
export function getAllSpecificThings(thingType: typeof ThingType.Thing.Ship): GameType.ShipType[];
export function getAllSpecificThings(thingType: typeof ThingType.Thing.PlanetValue): GameType.PlanetValueType[];
export function getAllSpecificThings(thingType: typeof ThingType.Thing.PlayerValue): GameType.PlayerValueType[];
export function getAllSpecificThings(thingType: typeof ThingType.Thing.Research): GameType.ResearchType[];
export function getAllSpecificThings(thingType: ThingType.Thing): ThingType.SpecificThing[];
export function getAllSpecificThings(thingType: ThingType.Thing): ThingType.SpecificThing[]
{
    switch (thingType)
    {
        case ThingType.Thing.Building:
        {
            return [...StaticData.BUILDING_STATS.keys()];
        }
        case ThingType.Thing.Research:
        {
            return [...StaticData.REASEARCH_INFO.keys()];
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
        case ThingType.Thing.PlayerValue:
        {
            return [...StaticData.PLAYER_VALUE_INFOS.keys()];
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

    const zoneDifference: number = origin.zone === target.zone ? 0 : 1;
    if (zoneDifference !== 0)
    {
        return StaticData.PLANET_TO_MOON_DISTANCE;
    }

    return 0;
}

export function isSameAddress(origin: GameType.PlanetAddress, target: GameType.PlanetAddress): boolean
{
    return (origin.galaxy === target.galaxy) && (origin.system === target.system) && (origin.slot === target.slot) && (origin.zone === target.zone);
}

export function isBuildableOnZone(buildableZones: GameType.PlanetZone[], zone: GameType.PlanetZone): boolean
{
    return buildableZones.includes(zone);
}

export function formatPlanetAddress(galaxy: number, system: number, slot: number, zone: GameType.PlanetZone): string
{
    const planetZoneInfo: GameType.PlanetZoneInfo = getPlanetZoneInfo(zone);
    const baseLabel: string = `[${galaxy}:${system}:${slot}]`;

    if (zone === GameType.PlanetZone.Planet)
    {
        return baseLabel;
    }

    return `${baseLabel} (${planetZoneInfo.displayName})`;
}

export function getPlanetDisplayName(planetRow: DBType.PlanetRow): string
{
    const trimmedName: string = (planetRow.name ?? "").trim();
    if (trimmedName.length > 0)
    {
        return trimmedName;
    }

    return formatPlanetAddress(planetRow.galaxy, planetRow.system, planetRow.slot, planetRow.zone as GameType.PlanetZone);
}

export function getDisplayNameForAddress(playerData: CoreType.PlayerData, address: GameType.PlanetAddress): string
{
    const ownPlanetData: CoreType.PlanetData | undefined = playerData.planetDatas.find((planetData: CoreType.PlanetData): boolean =>
    {
        return planetData.planetRow.galaxy === address.galaxy
            && planetData.planetRow.system === address.system
            && planetData.planetRow.slot === address.slot
            && planetData.planetRow.zone === address.zone;
    });

    if (ownPlanetData !== undefined)
    {
        return getPlanetDisplayName(ownPlanetData.planetRow);
    }

    return formatPlanetAddress(address.galaxy, address.system, address.slot, address.zone);
}

export function kelvinToCelsius(kelvin: number): number
{
	return kelvin - StaticData.KELVIN_OFFSET;
}

export function rollTemperatureForSlot(slot: number): number
{
	const range: GameType.SlotTemperatureRange = StaticData.SLOT_TEMPERATURE_RANGES[slot - 1];
	const span: number = range.max - range.min;
	return range.min + Math.floor(Math.random() * (span + 1));
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