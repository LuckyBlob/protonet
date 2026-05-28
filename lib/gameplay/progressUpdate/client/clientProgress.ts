"use client";

import * as UseClientDataState from "@/lib/use/useClientDataState";
import * as AnchorEvent from "@/lib/gameplay/progressUpdate/anchorEvent"
import * as PlayerDataType from "@/lib/gameplay/gameplayData/player/playerDataTypes";
import * as ClientRequestFunctions from "@/lib/networkRequests/client/clientRequestFunctions";
import * as ApplyProgress from "@/lib/gameplay/progressUpdate/applyProgress"
import * as ServerDataType from "@/lib/gameplay/gameplayData/server/serverDataTypes";
import * as FleetArrival from "@/lib/gameplay/progressUpdate/anchorEvent/fleetArrivalAnchorEvent"
import * as PlayerData from "@/lib/gameplay/gameplayData/player/playerData";
import * as FleetData from "@/lib/gameplay/gameplayData/dynamic/fleetData";
import * as SelectedPlanet from "@/lib/localStorage/selectedPlanet";

class ClientPlayerProgressResolver extends ApplyProgress.PlayerProgressApplier
{
    applyPlayerProgressAtTime(playerData: PlayerDataType.PlayerData, serverData: ServerDataType.ServerData, targetPlayerId: number, time: number): PlayerDataType.PlayerData | null
    {
        if (playerData.playerRow.id !== targetPlayerId)
        {
            return null;
        }

        const updatedPlayerData: PlayerDataType.PlayerData = ApplyProgress.applyProgressToPlayerData(playerData, serverData, time, this);
        return updatedPlayerData;
    }

    getFleetPlayerData(playerId: number | null, planetId: number, playerData: PlayerDataType.PlayerData, anchorEvent: FleetArrival.FleetArrivalAnchorEvent) : FleetData.FleetPlayerData | null
    {
        if (playerId === null || playerData.playerRow.id !== playerId)
        {
            return null;
        }

        const associatedFullPlanetData: PlayerDataType.FullPlanetData | null = PlayerData.getFullPlanetDataForId(playerData.fullPlanetDatas, planetId);
        if (associatedFullPlanetData === null)
        {
            throw new Error(`⚠️: Cant get full planet data for fleet.`); 
        }

        const fleetPlayerData: FleetData.FleetPlayerData =
        {
            playerData: playerData,
            fullPlanetData: associatedFullPlanetData,
        }

        return fleetPlayerData;
    }
}
export function applyPlayerUpdate(playerData: PlayerDataType.PlayerData, serverData: ServerDataType.ServerData, now: number): PlayerDataType.PlayerData
{
    const clientProgressResolver: ClientPlayerProgressResolver = new ClientPlayerProgressResolver();
    const updatedPlayerData: PlayerDataType.PlayerData | null = clientProgressResolver.applyPlayerProgressAtTime(playerData, serverData, playerData.playerRow.id, now);
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
    clientDataStateResult.psController[1]((mostRecentState: PlayerDataType.PlayerState): PlayerDataType.PlayerState =>
    {
        const updatedPredictedPlayerData: PlayerDataType.PlayerData | null = applyPlayerUpdate(mostRecentState.dbData, clientDataStateResult.sdsController[0], now);

        const currentlySelectedPlanetId: number = SelectedPlanet.updateSelectedPlanetIdInStorage(updatedPredictedPlayerData);
        const loadedPlayerState: PlayerDataType.PlayerState =
        {
            dbData: mostRecentState.dbData,
            predictedDBData: updatedPredictedPlayerData,
            selectedPlanetId: currentlySelectedPlanetId,
            lastFetchTimestamp: Date.now(),
        };

        return loadedPlayerState;
    });
}

