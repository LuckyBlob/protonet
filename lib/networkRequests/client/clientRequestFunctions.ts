"use client";

import * as SelectedPlanet from "@/lib/localStorage/selectedPlanet";
import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as UseClientDataState from "@/lib/use/useClientDataState";
import * as Serialization from "@/lib/helper/serialization";
import * as ServerRequest from "@/lib/networkRequests/serverRequests";
import * as RequestType from "@/lib/networkRequests/requestTypes";
import * as APIEndPoint from "@/app/api/apiEndPoints";
import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";

//#region Player state helpers

export function setPlayerState(psController: CoreType.PSController, newPlayerData: CoreType.PlayerData): void
{
    const currentlySelectedPlanetId: number = SelectedPlanet.updateSelectedPlanetIdInStorage(newPlayerData);
    const loadedPlayerState: CoreType.PlayerState =
    {
        dbData: newPlayerData,
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

export async function clientTryPlayerDataRequest(psController: CoreType.PSController): Promise<void>
{
    const response: APIEndPoint.ResponseForData<typeof APIEndPoint.DataRequest.PlayerData> | null = await ServerRequest.requestServerData(APIEndPoint.DataRequest.PlayerData);
    // Use != instead of !== here to catch everything that's very weird.
    if (response === null || response.serializedPlayerData == null)
    {
        const serverError: string = response === null ? "no response" : (response.error ?? "no error message");
        throw new Error(`Failed to fetch player data: ${serverError}`);
    }
    const playerData: CoreType.PlayerData = Serialization.deserializePlayerData(response.serializedPlayerData);
    await setPlayerState(psController, playerData);
}

export async function clientTryServerConfigRequest(sdsController: CoreType.SDSController): Promise<void>
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
    const response: APIEndPoint.ResponseForAction<typeof APIEndPoint.ActionRequest.Login> = await ServerRequest.requestServerAction(APIEndPoint.ActionRequest.Login, clientRequest);
    if (response.error !== null)
    {
        throw new Error(response.error);
    }

    // Use != instead of !== here to catch everything that's very weird.
    if (response.username == null)
    {
        throw new Error(`Logout server failed: Invalid player data.`);
    }
    return response;
}

export async function clientTryRegisterRequest(username: string, password: string): Promise<APIEndPoint.ResponseForAction<typeof APIEndPoint.ActionRequest.Register>>
{
    const clientRequest: APIEndPoint.RequestForAction<typeof APIEndPoint.ActionRequest.Register> =
    {
        username: username,
        password: password,
    };

    const response: APIEndPoint.ResponseForAction<typeof APIEndPoint.ActionRequest.Register> = await ServerRequest.requestServerAction(APIEndPoint.ActionRequest.Register, clientRequest);

    if (response.error !== null)
    {
        throw new Error(response.error);
    }

    // Use != instead of !== here to catch everything that's very weird.
    if (response.username == null)
    {
        throw new Error(`Logout server failed: Invalid player data.`);
    }

    return response;
}

export async function clientTryDeleteUserRequest(): Promise<APIEndPoint.ResponseForAction<typeof APIEndPoint.ActionRequest.DeleteUser>>
{
    const clientRequest: APIEndPoint.RequestForAction<typeof APIEndPoint.ActionRequest.DeleteUser> = {};

    const response: APIEndPoint.ResponseForAction<typeof APIEndPoint.ActionRequest.DeleteUser> = await ServerRequest.requestServerAction(APIEndPoint.ActionRequest.DeleteUser, clientRequest);

    if (response.error !== null)
    {
        throw new Error(response.error);
    }

    return response;
}


export async function clientTryLogoutRequest(): Promise<APIEndPoint.ResponseForAction<typeof APIEndPoint.ActionRequest.Logout> | null>
{
    try
    {
        const response: APIEndPoint.ResponseForAction<typeof APIEndPoint.ActionRequest.Logout> = await ServerRequest.requestServerAction(APIEndPoint.ActionRequest.Logout, null);
        if (response.error !== null)
        {
            throw new Error(response.error);
        }

        // Use != instead of !== here to catch everything that's very weird.
        if (response.username == null)
        {
            throw new Error(`Logout server failed: Invalid player data.`);
        }

        return response;
    }
    catch (error: unknown)
    {
        console.error("⚠️:", error);
        return null;
    }
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
        const playerData: CoreType.PlayerData = Serialization.deserializePlayerData(response.serializedPlayerData);
        await setPlayerState(clientDataStateResult.psController, playerData);
        clientDataStateResult.sdsController[1](response.serverData);
    }
    catch (error: unknown)
    {
        console.error("⚠️:", error);
    }
}

export async function clientTryUpgradeBuildingRequest(psController: CoreType.PSController, planetId: number, buildingType: number): Promise<void>
{
    const clientRequest: APIEndPoint.RequestForAction<typeof APIEndPoint.ActionRequest.UpgradeBuilding> =
    {
        buildingType: buildingType,
        planetId: planetId,
    };

    try
    {
        const response: APIEndPoint.ResponseForAction<typeof APIEndPoint.ActionRequest.UpgradeBuilding> = await ServerRequest.requestServerAction(APIEndPoint.ActionRequest.UpgradeBuilding, clientRequest);
        if (response.error !== null)
        {
            throw new Error(response.error);
        }
        // Use != instead of !== here to catch everything that's very weird.
        if (response.serializedPlayerData == null)
        {
        throw new Error(`Building upgrade failed for planetId ${planetId}: Invalid response from server.`);
        }

        const playerData: CoreType.PlayerData = Serialization.deserializePlayerData(response.serializedPlayerData);
        await setPlayerState(psController, playerData);
    }
    catch (error: unknown)
    {
        console.error("⚠️:", error);
    }
}

export async function clientTryBuildShipsRequest(psController: CoreType.PSController, planetId: number, shipQuantities: Map<number, number>): Promise<void>
{
    const clientRequest: APIEndPoint.RequestForAction<typeof APIEndPoint.ActionRequest.BuildShips> =
    {
        planetId: planetId,
        serializedShipQuantities: Serialization.serializeNumberNumberMap(shipQuantities),
    };

    try
    {
        const response: APIEndPoint.ResponseForAction<typeof APIEndPoint.ActionRequest.BuildShips> = await ServerRequest.requestServerAction(APIEndPoint.ActionRequest.BuildShips, clientRequest);
        if (response.error !== null)
        {
            throw new Error(response.error);
        }
        // Use != instead of !== here to catch everything that's very weird.
        if (response.serializedPlayerData == null)
        {
            throw new Error(`Build ships failed for planetId ${planetId}: Invalid response from server.`);
        }

        const playerData: CoreType.PlayerData = Serialization.deserializePlayerData(response.serializedPlayerData);
        await setPlayerState(psController, playerData);
    }
    catch (error: unknown)
    {
        console.error("⚠️:", error);
    }
}

export async function clientTrySendFleetRequest(psController: CoreType.PSController, originPlanetId: number, targetPlanetAddress: GameType.PlanetAddress, fleetAction: number, shipQuantities: Map<number, number>, resourceQuantities: Map<number, number>): Promise<string | null>
{
    const clientRequest: APIEndPoint.RequestForAction<typeof APIEndPoint.ActionRequest.SendFleet> =
    {
        originPlanetId: originPlanetId,
        targetPlanetGalaxy: targetPlanetAddress.galaxy,
        targetPlanetSystem: targetPlanetAddress.system,
        targetPlanetPosition: targetPlanetAddress.slot,
        fleetAction: fleetAction,
        serializedShipQuantities: Serialization.serializeNumberNumberMap(shipQuantities),
        serializedResourceQuantities: Serialization.serializeNumberNumberMap(resourceQuantities),
    };

    try
    {
        const response: APIEndPoint.ResponseForAction<typeof APIEndPoint.ActionRequest.SendFleet> = await ServerRequest.requestServerAction(APIEndPoint.ActionRequest.SendFleet, clientRequest);
        if (response.error !== null)
        {
            throw new Error(response.error);
        }
        // Use != instead of !== here to catch everything that's very weird.
        if (response.serializedPlayerData == null)
        {
            throw new Error(`Send fleet failed for planetId ${originPlanetId}: Invalid response from server.`);
        }

        const playerData: CoreType.PlayerData = Serialization.deserializePlayerData(response.serializedPlayerData);
        await setPlayerState(psController, playerData);
        return null;
    }
    catch (error: unknown)
    {
        if (error instanceof Error)
        {
            return error.message;
        }

        return String(error);
    }
}

export async function clientTryDeleteMessageRequest(psController: CoreType.PSController, messageRowId: number, predictedPreview: CoreType.MessagePreview | null): Promise<string | null>
{
    const clientRequest: APIEndPoint.RequestForAction<typeof APIEndPoint.ActionRequest.DeleteMessage> = buildMessageActionRequest(messageRowId, predictedPreview);

    try
    {
        const response: APIEndPoint.ResponseForAction<typeof APIEndPoint.ActionRequest.DeleteMessage> = await ServerRequest.requestServerAction(APIEndPoint.ActionRequest.DeleteMessage, clientRequest);
        if (response.error !== null)
        {
            throw new Error(response.error);
        }
        // Use != instead of !== here to catch everything that's very weird.
        if (response.serializedPlayerData == null)
        {
            throw new Error(`Delete message failed for messageRowId ${messageRowId}: Invalid response from server.`);
        }

        const playerData: CoreType.PlayerData = Serialization.deserializePlayerData(response.serializedPlayerData);
        await setPlayerState(psController, playerData);
        return null;
    }
    catch (error: unknown)
    {
        if (error instanceof Error)
        {
            return error.message;
        }

        return String(error);
    }
}

export async function clientTryMarkMessageReadRequest(psController: CoreType.PSController, messageRowId: number, predictedPreview: CoreType.MessagePreview | null): Promise<string | null>
{
    const clientRequest: APIEndPoint.RequestForAction<typeof APIEndPoint.ActionRequest.MarkMessageRead> = buildMessageActionRequest(messageRowId, predictedPreview);

    try
    {
        const response: APIEndPoint.ResponseForAction<typeof APIEndPoint.ActionRequest.MarkMessageRead> = await ServerRequest.requestServerAction(APIEndPoint.ActionRequest.MarkMessageRead, clientRequest);
        if (response.error !== null)
        {
            throw new Error(response.error);
        }
        // Use != instead of !== here to catch everything that's very weird.
        if (response.serializedPlayerData == null)
        {
            throw new Error(`Mark message read failed for messageRowId ${messageRowId}: Invalid response from server.`);
        }

        const playerData: CoreType.PlayerData = Serialization.deserializePlayerData(response.serializedPlayerData);
        await setPlayerState(psController, playerData);
        return null;
    }
    catch (error: unknown)
    {
        if (error instanceof Error)
        {
            return error.message;
        }

        return String(error);
    }
}

// Same payload shape is used by both mark-read and delete (id, plus predicted fields
// when id === -1). Predicted fields identify a not-yet-reconciled local message; the
// field set must stay aligned with MessageData.doMessagePreviewsMatch.
function buildMessageActionRequest(messageRowId: number, predictedPreview: CoreType.MessagePreview | null): { messageRowId: number; predictedReceivedAt?: number; predictedTitle?: string }
{
    if (messageRowId === -1)
    {
        if (predictedPreview === null)
        {
            throw new Error(`Message action called with messageRowId -1 but no predictedPreview to identify it.`);
        }

        return {
            messageRowId: messageRowId,
            predictedReceivedAt: predictedPreview.receivedAt,
            predictedTitle: predictedPreview.title,
        };
    }

    return { messageRowId: messageRowId };
}

export async function clientTryAbandonPlanet(psController: CoreType.PSController): Promise<string | null>
{
    const clientRequest: APIEndPoint.RequestForAction<typeof APIEndPoint.ActionRequest.AbandonPlanet> =
    {
        planetId: psController[0].selectedPlanetId,
    };

    try
    {
        const response: APIEndPoint.ResponseForAction<typeof APIEndPoint.ActionRequest.AbandonPlanet> = await ServerRequest.requestServerAction(APIEndPoint.ActionRequest.AbandonPlanet, clientRequest);
        if (response.error !== null)
        {
            throw new Error(response.error);
        }
        // Use != instead of !== here to catch everything that's very weird.
        if (response.serializedPlayerData == null)
        {
            throw new Error(`Abandon planet failed for planetId ${psController[0].selectedPlanetId}: Invalid response from server.`);
        }

        const playerData: CoreType.PlayerData = Serialization.deserializePlayerData(response.serializedPlayerData);
        await setPlayerState(psController, playerData);
        return null;
    }
    catch (error: unknown)
    {
        if (error instanceof Error)
        {
            return error.message;
        }

        return String(error);
    }
}
//#endregion
