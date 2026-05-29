"use client";

import * as UseClientDataState from "@/lib/use/useClientDataState";
import * as AnchorEvent from "@/lib/gameplay/progressUpdate/anchorEvent"
import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as ClientRequestFunctions from "@/lib/networkRequests/client/clientRequestFunctions";
import * as ApplyProgress from "@/lib/gameplay/progressUpdate/applyProgress"
import * as FleetArrival from "@/lib/gameplay/progressUpdate/anchorEvent/fleetArrivalAnchorEvent"
import * as FleetData from "@/lib/gameplay/gameplayData/dynamic/fleetData";
import * as SelectedPlanet from "@/lib/localStorage/selectedPlanet";

class ClientPlayerProgressResolver extends ApplyProgress.PlayerProgressApplier
{
    applyPlayerProgressAtTime(playerData: CoreType.PlayerData, serverData: CoreType.ServerData, targetPlayerId: number, time: number): CoreType.PlayerData | null
    {
        if (playerData.playerRow.id !== targetPlayerId)
        {
            return null;
        }

        const updatedPlayerData: CoreType.PlayerData = ApplyProgress.applyProgressToPlayerData(playerData, serverData, time, this);
        return updatedPlayerData;
    }

    getFleetPlayerData(playerId: number | null, planetId: number, playerData: CoreType.PlayerData, anchorEvent: FleetArrival.FleetArrivalAnchorEvent) : FleetData.FleetPlayerData | null
    {
        if (playerId === null || playerData.playerRow.id !== playerId)
        {
            return null;
        }

        const associatedPlanetData: CoreType.PlanetData | null = CoreType.getPlanetDataForId(playerData.planetDatas, planetId);
        if (associatedPlanetData === null)
        {
            throw new Error(`⚠️: Cant get full planet data for fleet.`); 
        }

        const fleetPlayerData: FleetData.FleetPlayerData =
        {
            playerData: playerData,
            planetData: associatedPlanetData,
        }

        return fleetPlayerData;
    }
}
export function applyPlayerUpdate(playerData: CoreType.PlayerData, serverData: CoreType.ServerData, now: number): CoreType.PlayerData
{
    const clientProgressResolver: ClientPlayerProgressResolver = new ClientPlayerProgressResolver();
    const updatedPlayerData: CoreType.PlayerData | null = clientProgressResolver.applyPlayerProgressAtTime(playerData, serverData, playerData.playerRow.id, now);
    if (updatedPlayerData === null)
    {
        throw new Error(`UNREACHABLE: Player progress resolver returned null for player ID ${playerData.playerRow.id}`);
    }

    return updatedPlayerData;
}

export function runClientTick(clientDataStateResult: UseClientDataState.ClientDataStateResult): void
{
    const now: number = Date.now();

    // use this to make sure we get the latest state since the tick might have copied old data and we might have updated that 
    // data before the next tick. So when we receive the next tick the psController[0] is from before data reception
    clientDataStateResult.psController[1]((mostRecentState: CoreType.PlayerState): CoreType.PlayerState =>
    {
        const updatedPredictedPlayerData: CoreType.PlayerData | null = applyPlayerUpdate(mostRecentState.dbData, clientDataStateResult.sdsController[0], now);

        const currentlySelectedPlanetId: number = SelectedPlanet.updateSelectedPlanetIdInStorage(updatedPredictedPlayerData);
        const loadedPlayerState: CoreType.PlayerState =
        {
            dbData: mostRecentState.dbData,
            predictedDBData: updatedPredictedPlayerData,
            selectedPlanetId: currentlySelectedPlanetId,
            lastFetchTimestamp: Date.now(),
        };

        return loadedPlayerState;
    });
}

