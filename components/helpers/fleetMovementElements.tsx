"use client";

import { ReactElement } from "react";

import * as TimeFormat from "@/lib/helper/timeFormat";
import * as UseClientDataState from "@/lib/use/useClientDataState";
import * as ThingHelpers from "@/lib/gameplay/coreData/thing/thingHelpers";
import * as ThingDataHelpers from "@/lib/gameplay/coreData/thing/thingDataHelpers";
import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as FleetData from "@/lib/gameplay/dynamicData/planet/fleet/fleetData";
import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as ClientRequestFunctions from "@/lib/networkRequests/client/clientRequestFunctions";
import * as DBType from "@/lib/db/dbTypes";
import * as StaticDataHelper from "@/lib/gameplay/coreData/static/staticDataHelpers";

function renderZoneMarker(zone: GameType.PlanetZone): ReactElement | null
{
    if (zone === GameType.PlanetZone.Planet)
    {
        return null;
    }

    const zoneInfo: GameType.PlanetZoneInfo = StaticDataHelper.getPlanetZoneInfo(zone);

    return <img src={`/icons/zone/${zone}_color.png`} alt={zoneInfo.displayName} title={zoneInfo.displayName} className="w-4 h-4 object-contain inline-block align-text-bottom" />;
}

function renderFleetMovementRow(clientDataStateResult: UseClientDataState.ClientDataStateResult, fleetMovement: CoreType.FleetMovement, playerData: CoreType.PlayerData): ReactElement
{
    const fleetMovementRow: DBType.FleetMovementRow = fleetMovement.fleetMovementRow;
    const originZone: GameType.PlanetZone = fleetMovementRow.planet_origin_zone as GameType.PlanetZone;
    const targetZone: GameType.PlanetZone = fleetMovementRow.planet_target_zone as GameType.PlanetZone;
    const originAddress: string = StaticDataHelper.getDisplayNameForAddress(playerData, { galaxy: fleetMovementRow.planet_origin_galaxy, system: fleetMovementRow.planet_origin_system, slot: fleetMovementRow.planet_origin_slot, zone: originZone });
    const targetAddress: string = StaticDataHelper.getDisplayNameForAddress(playerData, { galaxy: fleetMovementRow.planet_target_galaxy, system: fleetMovementRow.planet_target_system, slot: fleetMovementRow.planet_target_slot, zone: targetZone });
    const actionName: string = ThingDataHelpers.getSpecificThingName(ThingHelpers.fleetAction(fleetMovementRow.fleet_action_type));
    const isReturnTrip: boolean = fleetMovementRow.is_return_trip === 1;
    const remainingMs: number | null = FleetData.getFleetMovementRemainingMs(fleetMovement);

    if (remainingMs === null)
    {
        throw new Error(`Fleet movement ${fleetMovementRow.id} has no started_at or duration_at_start_time.`);
    }

    const isUnknownResult: boolean = remainingMs < 0 && fleetMovement.resolutionState === CoreType.FleetMovementResolution.ResolveResultUnknown;

    const fleetActionInfo: GameType.FleetActionInfo = StaticDataHelper.getFleetActionInfo(fleetMovementRow.fleet_action_type as GameType.FleetActionType);
    const isOwnOutboundInFlight: boolean = (isReturnTrip === false) && (isUnknownResult === false) && (remainingMs > 0) && (fleetMovementRow.player_origin_id === playerData.playerRow.id) && (fleetActionInfo.canBeRecalled !== false);

    const handleRecall = (): void =>
    {
        ClientRequestFunctions.clientTryRecallFleetRequest(clientDataStateResult.psController, fleetMovementRow.id);
    };

    const recallElement: ReactElement | null = isOwnOutboundInFlight === true
        ? <button type="button" onClick={handleRecall} className="text-blue-400 hover:text-blue-300 underline text-xs">Recall</button>
        : null;

    const element: ReactElement =
    (
        <div key={fleetMovementRow.id} className="border border-gray-400 rounded px-4 py-2 text-sm text-white w-full">
            <div className="flex flex-row items-center gap-1">
                <span>{originAddress}</span>
                {renderZoneMarker(originZone)}
                <span>→</span>
                <span>{targetAddress}</span>
                {renderZoneMarker(targetZone)}
            </div>
            {isUnknownResult ?
            (
                <div className="text-sm font-semibold text-yellow-400">Unknown result.</div>
            ) : (
            <>
                <div>{actionName}{isReturnTrip ? " (return)" : ""}</div>
                <div className="text-gray-400">
                    {TimeFormat.formatRemainingTimeMs(remainingMs)}
                </div>
                {recallElement}
            </>
            )}
        </div>
    );

    return element;
}

export function renderFleetMovementsSection(clientDataStateResult: UseClientDataState.ClientDataStateResult, category: GameType.FleetActionCategory): ReactElement
{
    const playerData: CoreType.PlayerData = clientDataStateResult.psController[0].predictedDBData;

    const seenFleetIds: Set<number> = new Set<number>();
    const fleetMovements: CoreType.FleetMovement[] = [];

    for (const planetData of playerData.planetDatas)
    {
        for (const fleetMovement of planetData.dynamicPlanetData.futureFleetArrivals)
        {
            if (seenFleetIds.has(fleetMovement.fleetMovementRow.id) === true)
            {
                continue;
            }
            seenFleetIds.add(fleetMovement.fleetMovementRow.id);

            const fleetActionInfo: GameType.FleetActionInfo = StaticDataHelper.getFleetActionInfo(fleetMovement.fleetMovementRow.fleet_action_type as GameType.FleetActionType);
            if (fleetActionInfo.category !== category)
            {
                continue;
            }

            fleetMovements.push(fleetMovement);
        }
    }

    if (fleetMovements.length === 0)
    {
        const emptyElement: ReactElement =
        (
            <div className="border border-gray-400 rounded px-6 py-3 text-sm text-center text-gray-400 w-full h-24 flex items-center justify-center">
                No fleet movements.
            </div>
        );

        return emptyElement;
    }

    const movementElements: ReactElement[] = fleetMovements.map((fleetMovement: CoreType.FleetMovement): ReactElement =>
    {
        return renderFleetMovementRow(clientDataStateResult, fleetMovement, playerData);
    });

    const element: ReactElement =
    (
        <div className="flex flex-col gap-2 w-full">
            {movementElements}
        </div>
    );

    return element;
}
