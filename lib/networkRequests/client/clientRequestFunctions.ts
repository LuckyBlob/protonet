"use client";

import * as SelectedPlanet from "@/lib/localStorage/selectedPlanet";
import * as PlayerDataType from "@/lib/gameplay/gameplayData/player/playerDataTypes";
import * as ServerDataType from "@/lib/gameplay/gameplayData/server/serverDataTypes";
import * as UseClientDataState from "@/lib/use/useClientDataState";
import * as PlayerDataSerialization from "@/lib/helper/serialization";
import * as ServerRequest from "@/lib/networkRequests/serverRequests";
import * as RequestType from "@/lib/networkRequests/requestTypes";
import * as APIEndPoint from "@/app/api/apiEndPoints";

//#region Player state helpers

export function setPlayerState(psController: PlayerDataType.PSController, newPlayerData: PlayerDataType.PlayerData): void
{
    const currentlySelectedPlanetId: number = SelectedPlanet.updateSelectedPlanetIdInStorage(psController, newPlayerData);
    const loadedPlayerState: PlayerDataType.PlayerState =
    {
        dbData: newPlayerData,
        predictedDBData: newPlayerData,
        selectedPlanetId: currentlySelectedPlanetId,
        lastFetchTimestamp: Date.now(),
    };
    psController[1](loadedPlayerState);
}

export function setPredictedPlayerState(psController: PlayerDataType.PSController, newPlayerData: PlayerDataType.PlayerData): void
{
    const currentlySelectedPlanetId: number = SelectedPlanet.updateSelectedPlanetIdInStorage(psController, newPlayerData);
    const loadedPlayerState: PlayerDataType.PlayerState =
    {
        dbData: psController[0].dbData,
        predictedDBData: newPlayerData,
        selectedPlanetId: currentlySelectedPlanetId,
        lastFetchTimestamp: Date.now(),
    };
    psController[1](loadedPlayerState);
}

//#endregion

//#region Data requests

export async function clientTryUserInfoRequest(): Promise<APIEndPoint.ResponseForData<typeof APIEndPoint.DataRequest.UserInfo> | null>
{
    return ServerRequest.requestServerData(APIEndPoint.DataRequest.UserInfo);
}

export async function clientTryPlayerDataRequest(psController: PlayerDataType.PSController): Promise<void>
{
    const response: APIEndPoint.ResponseForData<typeof APIEndPoint.DataRequest.PlayerData> | null = await ServerRequest.requestServerData(APIEndPoint.DataRequest.PlayerData);
    // Use != instead of !== here to catch everything that's very weird.
    if (response === null || response.serializedPlayerData == null)
    {
        throw new Error(`Failed to fetch player data.`);
    }
    const playerData: PlayerDataType.PlayerData = PlayerDataSerialization.deserializePlayerData(response.serializedPlayerData);
    await setPlayerState(psController, playerData);
}

export async function clientTryServerConfigRequest(sdsController: ServerDataType.SDSController): Promise<void>
{
    const response: APIEndPoint.ResponseForData<typeof APIEndPoint.DataRequest.ServerConfig> | null = await ServerRequest.requestServerData(APIEndPoint.DataRequest.ServerConfig);
    // Use != instead of !== here to catch everything that's very weird.
    if (response === null || response.serverData == null)
    {
        throw new Error(`Failed to fetch server data.`);
    }
    sdsController[1](response.serverData);
}

//#endregion

//#region Action requests

export async function clientTryLoginRequest(username: string, password: string): Promise<APIEndPoint.ResponseForAction<typeof APIEndPoint.ActionRequest.Login>>
{
    const clientRequest: APIEndPoint.RequestForAction<typeof APIEndPoint.ActionRequest.Login> =
    {
        username: username,
        password: password,
    };
    return ServerRequest.requestServerAction(APIEndPoint.ActionRequest.Login, clientRequest);
}

export async function clientTryRegisterRequest(username: string, password: string): Promise<APIEndPoint.ResponseForAction<typeof APIEndPoint.ActionRequest.Register>>
{
    const clientRequest: APIEndPoint.RequestForAction<typeof APIEndPoint.ActionRequest.Register> =
    {
        username: username,
        password: password,
    };
    return ServerRequest.requestServerAction(APIEndPoint.ActionRequest.Register, clientRequest);
}

export async function clientTryLogoutRequest(): Promise<APIEndPoint.ResponseForAction<typeof APIEndPoint.ActionRequest.Logout>>
{
    return ServerRequest.requestServerAction(APIEndPoint.ActionRequest.Logout, null);
}

export async function clientTryRefreshServerRequest(clientDataStateResult: UseClientDataState.ClientDataStateResult): Promise<void>
{
    try
    {
        const response: APIEndPoint.ResponseForAction<typeof APIEndPoint.ActionRequest.RefreshServer> = await ServerRequest.requestServerAction(APIEndPoint.ActionRequest.RefreshServer, null);
        if (response.error !== null)
        {
            throw new Error(response.error);
        }
        // Use != instead of !== here to catch everything that's very weird.
        if (response.serializedPlayerData == null)
        {
            throw new Error(`Refresh server failed: Invalid player data.`);
        }
        // Use != instead of !== here to catch everything that's very weird.
        if (response.serverData == null)
        {
            throw new Error(`Refresh server failed: Invalid server data.`);
        }
        const playerData: PlayerDataType.PlayerData = PlayerDataSerialization.deserializePlayerData(response.serializedPlayerData);
        await setPlayerState(clientDataStateResult.psController, playerData);
        clientDataStateResult.sdsController[1](response.serverData);
    }
    catch (error: unknown)
    {
        console.warn("⚠️:", error);
    }
}

export async function clientTryUpgradeBuildingRequest(psController: PlayerDataType.PSController, planetId: number, buildingType: number): Promise<void>
{
    const clientRequest: APIEndPoint.RequestForAction<typeof APIEndPoint.ActionRequest.UpgradeBuilding> =
    {
        buildingType: buildingType,
        planetId: planetId,
    };
    const response: APIEndPoint.ResponseForAction<typeof APIEndPoint.ActionRequest.UpgradeBuilding> = await ServerRequest.requestServerAction(APIEndPoint.ActionRequest.UpgradeBuilding, clientRequest);
    // Use != instead of !== here to catch everything that's very weird.
    if (response.serializedPlayerData == null)
    {
        throw new Error(`Building upgrade failed for planetId ${planetId}: Invalid response from server.`);
    }
    const playerData: PlayerDataType.PlayerData = PlayerDataSerialization.deserializePlayerData(response.serializedPlayerData);
    await setPlayerState(psController, playerData);
}

export async function clientTryBuildShipsRequest(psController: PlayerDataType.PSController, planetId: number, shipQuantities: RequestType.ShipQuantityRequest[]): Promise<void>
{
    const clientRequest: APIEndPoint.RequestForAction<typeof APIEndPoint.ActionRequest.BuildShips> =
    {
        planetId: planetId,
        shipQuantities: shipQuantities,
    };
    const response: APIEndPoint.ResponseForAction<typeof APIEndPoint.ActionRequest.BuildShips> = await ServerRequest.requestServerAction(APIEndPoint.ActionRequest.BuildShips, clientRequest);
    // Use != instead of !== here to catch everything that's very weird.
    if (response.serializedPlayerData == null)
    {
        throw new Error(`Build ships failed for planetId ${planetId}: Invalid response from server.`);
    }
    const playerData: PlayerDataType.PlayerData = PlayerDataSerialization.deserializePlayerData(response.serializedPlayerData);
    await setPlayerState(psController, playerData);
}

//#endregion
