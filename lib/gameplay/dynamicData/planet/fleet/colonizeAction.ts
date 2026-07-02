// This should be server only!

import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as StaticDataHelper from "@/lib/gameplay/coreData/static/staticDataHelpers";
import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as UnitData from "@/lib/gameplay/dynamicData/planet/unitData";
import * as ResourceData from "@/lib/gameplay/dynamicData/planet/resourceData";
import * as FleetData from "@/lib/gameplay/dynamicData/planet/fleet/fleetData";
import * as DBType from "@/lib/db/dbTypes";
import * as MessageData from "@/lib/gameplay/dynamicData/player/messageData";
import * as DB from "@/lib/db/db";
import * as ServerPlanetManagement from "@/lib/gameplay/progressUpdate/server/serverPlanetManagement";
import * as CalculatedValueData from "@/lib/gameplay/dynamicData/calculatedValueData";

export function resolveColonizeAction(originPlayerData: CoreType.PlayerData, fleetMovement: CoreType.FleetMovement, serverData: CoreType.ServerData): CoreType.PlayerData | null
{
    const originPlanetData: CoreType.PlanetData | null = CoreType.getPlanetDataForId(originPlayerData.planetDatas, fleetMovement.fleetMovementRow.planet_origin_id);
    if (originPlanetData === null)
    {
        throw new Error(`⚠️: Failed to resolve colonize action because origin planet was null.`);
    }

    // Too many planets (moons don't count toward the colony cap)
    if (CoreType.getOwnedPlanets(originPlayerData.planetDatas).length >= CalculatedValueData.computeMaxOwnedPlanetCount(originPlayerData))
    {
        addTooManyPlanetsFailureMessage(fleetMovement);
        FleetData.setFleetReturnTrip(null, fleetMovement);
        fleetMovement.resolutionState = CoreType.FleetMovementResolution.Resolved;
        return null;
    }

    const targetAddress: GameType.PlanetAddress =
    {
        galaxy: fleetMovement.fleetMovementRow.planet_target_galaxy,
        system: fleetMovement.fleetMovementRow.planet_target_system,
        slot: fleetMovement.fleetMovementRow.planet_target_slot,
        zone: fleetMovement.fleetMovementRow.planet_target_zone as GameType.PlanetZone,
    };

    // if that address is now owned → return trip + failure message, like the too-many-planets branch
    if (addressIsTaken(targetAddress))
    {
        addColonizeFailedTargetTakenMessage(fleetMovement);
        FleetData.setFleetReturnTrip(null, fleetMovement);
        fleetMovement.resolutionState = CoreType.FleetMovementResolution.Resolved;
        return null;
    }
    
    const planetId: number = ServerPlanetManagement.claimPlanet(targetAddress, originPlayerData.playerRow.id, fleetMovement.fleetMovementRow.started_at! + fleetMovement.fleetMovementRow.duration_at_start_time!);
    const newPlanetRow: DBType.PlanetRow = DB.databaseConnection.prepare(
        "SELECT * FROM planet WHERE id = ?"
    ).get(planetId) as DBType.PlanetRow;

    const targetPlanetData: CoreType.PlanetData =
    {
        planetRow: newPlanetRow,
        dynamicPlanetData: structuredClone(CoreType.EmptyPlanetData),
    };
    originPlayerData.planetDatas.push(targetPlanetData);
    
    fleetMovement.fleetMovementRow.player_target_id = originPlayerData.playerRow.id;

    removeSingleColonyShipFromFleetMovement(fleetMovement);
    
    const unitQuantities: Map<GameType.UnitType, number> = FleetData.buildUnitQuantitiesFromRows(fleetMovement.fleetMovementUnitRows);
    UnitData.addPlanetUnits(targetPlanetData, unitQuantities);

    const resourceQuantities: Map<GameType.ResourceType, number> = FleetData.buildResourceQuantitiesFromRows(fleetMovement.fleetMovementResourceRows);
    ResourceData.addPlanetResources(targetPlanetData, resourceQuantities);

    FleetData.removeFleetMovement(originPlanetData, fleetMovement.fleetMovementRow.id);
    fleetMovement.resolutionState = CoreType.FleetMovementResolution.Resolved;

    addColonizeActionMessages(fleetMovement);

    return originPlayerData;
}

function addColonizeActionMessages(fleetMovement: CoreType.FleetMovement): void
{
    const fleetRow: DBType.FleetMovementRow = fleetMovement.fleetMovementRow;
    const targetAddress: string = StaticDataHelper.formatPlanetAddress(fleetRow.planet_target_galaxy, fleetRow.planet_target_system, fleetRow.planet_target_slot, fleetRow.planet_target_zone as GameType.PlanetZone);
    const receivedAt: number = fleetRow.started_at! + fleetRow.duration_at_start_time!;
    const unitsList: string = FleetData.buildUnitsListFromFleetMovement(fleetMovement.fleetMovementUnitRows);
    const resourcesList: string = FleetData.buildResourcesListFromFleetMovement(fleetMovement.fleetMovementResourceRows);

    fleetMovement.originMessageRow =
    {
        id: -1, // placeholder, will be set properly when message is created in DB
        player_id: fleetRow.player_origin_id,
        received_at: receivedAt,
        type: MessageData.MessageType.FleetAction,
        is_read: 0,
        title: "Colonize Fleet Action Report",
        body: `Colonized planet ${targetAddress} successfully, stored ${resourcesList} and stationed ${unitsList}.`,
    };
}

function removeSingleColonyShipFromFleetMovement(fleetMovement: CoreType.FleetMovement): void
{
    for (const fleetMovementUnitRow of fleetMovement.fleetMovementUnitRows)
    {
        if (fleetMovementUnitRow.unit_type === GameType.UnitType.ColonyShip)
        {
            if (fleetMovementUnitRow.unit_quantity > 0)
            {
                fleetMovementUnitRow.unit_quantity -= 1;
                return;
            }
        }
    }
}

function addTooManyPlanetsFailureMessage(fleetMovement: CoreType.FleetMovement): void
{
    const fleetRow: DBType.FleetMovementRow = fleetMovement.fleetMovementRow;
    const targetAddress: string = StaticDataHelper.formatPlanetAddress(fleetRow.planet_target_galaxy, fleetRow.planet_target_system, fleetRow.planet_target_slot, fleetRow.planet_target_zone as GameType.PlanetZone);
    const receivedAt: number = fleetRow.started_at! + fleetRow.duration_at_start_time!;

    fleetMovement.originMessageRow =
    {
        id: -1, // placeholder, will be set properly when message is created in DB
        player_id: fleetRow.player_origin_id,
        received_at: receivedAt,
        type: MessageData.MessageType.FleetAction,
        is_read: 0,
        title: "Colonize Fleet Action Report",
        body: `Failed to colonize planet ${targetAddress}, to many planets.`,
    };
}

function addressIsTaken(address: GameType.PlanetAddress): boolean
{
    const existingPlanet: { id: number } | undefined = DB.databaseConnection.prepare(
        "SELECT id FROM planet WHERE galaxy = ? AND system = ? AND slot = ? AND zone = ?"
    ).get(address.galaxy, address.system, address.slot, address.zone) as { id: number } | undefined;

    return existingPlanet !== undefined;
}

function addColonizeFailedTargetTakenMessage(fleetMovement: CoreType.FleetMovement): void
{
    const fleetRow: DBType.FleetMovementRow = fleetMovement.fleetMovementRow;
    const targetAddress: string = StaticDataHelper.formatPlanetAddress(fleetRow.planet_target_galaxy, fleetRow.planet_target_system, fleetRow.planet_target_slot, fleetRow.planet_target_zone as GameType.PlanetZone);
    const receivedAt: number = fleetRow.started_at! + fleetRow.duration_at_start_time!;

    fleetMovement.originMessageRow =
    {
        id: -1, // placeholder, will be set properly when message is created in DB
        player_id: fleetRow.player_origin_id,
        received_at: receivedAt,
        type: MessageData.MessageType.FleetAction,
        is_read: 0,
        title: "Colonize Fleet Action Report",
        body: `Failed to colonize planet ${targetAddress}, the address was already claimed.`,
    };
}