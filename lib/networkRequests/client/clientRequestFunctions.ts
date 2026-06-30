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

export async function clientTryLoginRequest(identifier: string, password: string): Promise<APIEndPoint.ResponseForAction<typeof APIEndPoint.ActionRequest.Login>>
{
    const clientRequest: APIEndPoint.RequestForAction<typeof APIEndPoint.ActionRequest.Login> =
    {
        identifier: identifier,
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
        throw new Error(`Login server failed: Invalid player data.`);
    }
    return response;
}

export async function clientTryRegisterRequest(username: string, email: string, password: string): Promise<APIEndPoint.ResponseForAction<typeof APIEndPoint.ActionRequest.Register>>
{
    const clientRequest: APIEndPoint.RequestForAction<typeof APIEndPoint.ActionRequest.Register> =
    {
        username: username,
        email: email,
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
        throw new Error(`Register server failed: Invalid player data.`);
    }

    return response;
}

export async function clientTryVerifyEmailRequest(token: string): Promise<APIEndPoint.ResponseForAction<typeof APIEndPoint.ActionRequest.VerifyEmail>>
{
    const clientRequest: APIEndPoint.RequestForAction<typeof APIEndPoint.ActionRequest.VerifyEmail> =
    {
        token: token,
    };

    const response: APIEndPoint.ResponseForAction<typeof APIEndPoint.ActionRequest.VerifyEmail> = await ServerRequest.requestServerAction(APIEndPoint.ActionRequest.VerifyEmail, clientRequest);
    if (response.error !== null)
    {
        throw new Error(response.error);
    }

    return response;
}

export async function clientTryResendVerificationRequest(): Promise<APIEndPoint.ResponseForAction<typeof APIEndPoint.ActionRequest.ResendVerification>>
{
    const response: APIEndPoint.ResponseForAction<typeof APIEndPoint.ActionRequest.ResendVerification> = await ServerRequest.requestServerAction(APIEndPoint.ActionRequest.ResendVerification, null);
    if (response.error !== null)
    {
        throw new Error(response.error);
    }

    return response;
}

export async function clientTryRequestPasswordResetRequest(identifier: string): Promise<APIEndPoint.ResponseForAction<typeof APIEndPoint.ActionRequest.RequestPasswordReset>>
{
    const clientRequest: APIEndPoint.RequestForAction<typeof APIEndPoint.ActionRequest.RequestPasswordReset> =
    {
        identifier: identifier,
    };

    const response: APIEndPoint.ResponseForAction<typeof APIEndPoint.ActionRequest.RequestPasswordReset> = await ServerRequest.requestServerAction(APIEndPoint.ActionRequest.RequestPasswordReset, clientRequest);
    if (response.error !== null)
    {
        throw new Error(response.error);
    }

    return response;
}

export async function clientTryResetPasswordRequest(token: string, password: string): Promise<APIEndPoint.ResponseForAction<typeof APIEndPoint.ActionRequest.ResetPassword>>
{
    const clientRequest: APIEndPoint.RequestForAction<typeof APIEndPoint.ActionRequest.ResetPassword> =
    {
        token: token,
        password: password,
    };

    const response: APIEndPoint.ResponseForAction<typeof APIEndPoint.ActionRequest.ResetPassword> = await ServerRequest.requestServerAction(APIEndPoint.ActionRequest.ResetPassword, clientRequest);
    if (response.error !== null)
    {
        throw new Error(response.error);
    }

    return response;
}

export async function clientTryChangeEmailRequest(email: string): Promise<APIEndPoint.ResponseForAction<typeof APIEndPoint.ActionRequest.ChangeEmail>>
{
    const clientRequest: APIEndPoint.RequestForAction<typeof APIEndPoint.ActionRequest.ChangeEmail> =
    {
        email: email,
    };

    const response: APIEndPoint.ResponseForAction<typeof APIEndPoint.ActionRequest.ChangeEmail> = await ServerRequest.requestServerAction(APIEndPoint.ActionRequest.ChangeEmail, clientRequest);
    if (response.error !== null)
    {
        throw new Error(response.error);
    }

    return response;
}

export async function clientTryChangeUsernameRequest(username: string): Promise<APIEndPoint.ResponseForAction<typeof APIEndPoint.ActionRequest.ChangeUsername>>
{
    const clientRequest: APIEndPoint.RequestForAction<typeof APIEndPoint.ActionRequest.ChangeUsername> =
    {
        username: username,
    };

    const response: APIEndPoint.ResponseForAction<typeof APIEndPoint.ActionRequest.ChangeUsername> = await ServerRequest.requestServerAction(APIEndPoint.ActionRequest.ChangeUsername, clientRequest);
    if (response.error !== null)
    {
        throw new Error(response.error);
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

export async function clientTryUpgradeBuildingRequest(psController: CoreType.PSController, planetId: number, buildingType: GameType.BuildingType): Promise<void>
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

export async function clientTryCancelBuildingUpgradeRequest(psController: CoreType.PSController, planetId: number): Promise<void>
{
    const clientRequest: APIEndPoint.RequestForAction<typeof APIEndPoint.ActionRequest.CancelBuildingUpgrade> =
    {
        planetId: planetId,
    };

    try
    {
        const response: APIEndPoint.ResponseForAction<typeof APIEndPoint.ActionRequest.CancelBuildingUpgrade> = await ServerRequest.requestServerAction(APIEndPoint.ActionRequest.CancelBuildingUpgrade, clientRequest);
        if (response.error !== null)
        {
            throw new Error(response.error);
        }
        // Use != instead of !== here to catch everything that's very weird.
        if (response.serializedPlayerData == null)
        {
            throw new Error(`Cancel building upgrade failed for planetId ${planetId}: Invalid response from server.`);
        }

        const playerData: CoreType.PlayerData = Serialization.deserializePlayerData(response.serializedPlayerData);
        await setPlayerState(psController, playerData);
    }
    catch (error: unknown)
    {
        console.error("⚠️:", error);
    }
}

export async function clientTryCancelBuildingDeconstructionRequest(psController: CoreType.PSController, planetId: number): Promise<void>
{
    const clientRequest: APIEndPoint.RequestForAction<typeof APIEndPoint.ActionRequest.CancelBuildingDeconstruction> =
    {
        planetId: planetId,
    };

    try
    {
        const response: APIEndPoint.ResponseForAction<typeof APIEndPoint.ActionRequest.CancelBuildingDeconstruction> = await ServerRequest.requestServerAction(APIEndPoint.ActionRequest.CancelBuildingDeconstruction, clientRequest);
        if (response.error !== null)
        {
            throw new Error(response.error);
        }
        // Use != instead of !== here to catch everything that's very weird.
        if (response.serializedPlayerData == null)
        {
            throw new Error(`Cancel building deconstruction failed for planetId ${planetId}: Invalid response from server.`);
        }

        const playerData: CoreType.PlayerData = Serialization.deserializePlayerData(response.serializedPlayerData);
        await setPlayerState(psController, playerData);
    }
    catch (error: unknown)
    {
        console.error("⚠️:", error);
    }
}

export async function clientTryDeconstructBuildingRequest(psController: CoreType.PSController, planetId: number, buildingType: GameType.BuildingType): Promise<void>
{
    const clientRequest: APIEndPoint.RequestForAction<typeof APIEndPoint.ActionRequest.DeconstructBuilding> =
    {
        buildingType: buildingType,
        planetId: planetId,
    };

    try
    {
        const response: APIEndPoint.ResponseForAction<typeof APIEndPoint.ActionRequest.DeconstructBuilding> = await ServerRequest.requestServerAction(APIEndPoint.ActionRequest.DeconstructBuilding, clientRequest);
        if (response.error !== null)
        {
            throw new Error(response.error);
        }
        // Use != instead of !== here to catch everything that's very weird.
        if (response.serializedPlayerData == null)
        {
        throw new Error(`Building deconstruction failed for planetId ${planetId}: Invalid response from server.`);
        }

        const playerData: CoreType.PlayerData = Serialization.deserializePlayerData(response.serializedPlayerData);
        await setPlayerState(psController, playerData);
    }
    catch (error: unknown)
    {
        console.error("⚠️:", error);
    }
}

export async function clientTryUpgradeResearchRequest(psController: CoreType.PSController, planetId: number, researchType: GameType.ResearchType): Promise<void>
{
    const clientRequest: APIEndPoint.RequestForAction<typeof APIEndPoint.ActionRequest.UpgradeResearch> =
    {
        researchType: researchType,
        planetId: planetId,
    };

    try
    {
        const response: APIEndPoint.ResponseForAction<typeof APIEndPoint.ActionRequest.UpgradeResearch> = await ServerRequest.requestServerAction(APIEndPoint.ActionRequest.UpgradeResearch, clientRequest);
        if (response.error !== null)
        {
            throw new Error(response.error);
        }
        // Use != instead of !== here to catch everything that's very weird.
        if (response.serializedPlayerData == null)
        {
        throw new Error(`Research failed for planetId ${planetId}: Invalid response from server.`);
        }

        const playerData: CoreType.PlayerData = Serialization.deserializePlayerData(response.serializedPlayerData);
        await setPlayerState(psController, playerData);
    }
    catch (error: unknown)
    {
        console.error("⚠️:", error);
    }
}

export async function clientTryBuildUnitsRequest(psController: CoreType.PSController, planetId: number, unitQuantities: Map<GameType.UnitType, number>): Promise<void>
{
    const clientRequest: APIEndPoint.RequestForAction<typeof APIEndPoint.ActionRequest.BuildUnits> =
    {
        planetId: planetId,
        serializedUnitQuantities: Serialization.serializeNumberNumberMap(unitQuantities),
    };

    try
    {
        const response: APIEndPoint.ResponseForAction<typeof APIEndPoint.ActionRequest.BuildUnits> = await ServerRequest.requestServerAction(APIEndPoint.ActionRequest.BuildUnits, clientRequest);
        if (response.error !== null)
        {
            throw new Error(response.error);
        }
        // Use != instead of !== here to catch everything that's very weird.
        if (response.serializedPlayerData == null)
        {
            throw new Error(`Build units failed for planetId ${planetId}: Invalid response from server.`);
        }

        const playerData: CoreType.PlayerData = Serialization.deserializePlayerData(response.serializedPlayerData);
        await setPlayerState(psController, playerData);
    }
    catch (error: unknown)
    {
        console.error("⚠️:", error);
    }
}

export async function clientTryDestroyMissilesRequest(psController: CoreType.PSController, planetId: number, unitQuantities: Map<GameType.UnitType, number>): Promise<void>
{
    const clientRequest: APIEndPoint.RequestForAction<typeof APIEndPoint.ActionRequest.DestroyMissiles> =
    {
        planetId: planetId,
        serializedUnitQuantities: Serialization.serializeNumberNumberMap(unitQuantities),
    };

    try
    {
        const response: APIEndPoint.ResponseForAction<typeof APIEndPoint.ActionRequest.DestroyMissiles> = await ServerRequest.requestServerAction(APIEndPoint.ActionRequest.DestroyMissiles, clientRequest);
        if (response.error !== null)
        {
            throw new Error(response.error);
        }
        // Use != instead of !== here to catch everything that's very weird.
        if (response.serializedPlayerData == null)
        {
            throw new Error(`Destroy missiles failed for planetId ${planetId}: Invalid response from server.`);
        }

        const playerData: CoreType.PlayerData = Serialization.deserializePlayerData(response.serializedPlayerData);
        await setPlayerState(psController, playerData);
    }
    catch (error: unknown)
    {
        console.error("⚠️:", error);
    }
}

export async function clientTryScanRequest(psController: CoreType.PSController, sourceMoonPlanetId: number, targetGalaxy: number, targetSystem: number, targetSlot: number): Promise<string | null>
{
    const clientRequest: APIEndPoint.RequestForAction<typeof APIEndPoint.ActionRequest.Scan> =
    {
        sourceMoonPlanetId: sourceMoonPlanetId,
        targetGalaxy: targetGalaxy,
        targetSystem: targetSystem,
        targetSlot: targetSlot,
    };

    try
    {
        const response: APIEndPoint.ResponseForAction<typeof APIEndPoint.ActionRequest.Scan> = await ServerRequest.requestServerAction(APIEndPoint.ActionRequest.Scan, clientRequest);
        if (response.error !== null)
        {
            return response.error;
        }
        // Use != instead of !== here to catch everything that's very weird.
        if (response.serializedPlayerData == null)
        {
            return `Scan failed for moon ${sourceMoonPlanetId}: Invalid response from server.`;
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

export async function clientTryJumpGateRequest(psController: CoreType.PSController, sourceMoonPlanetId: number, destinationMoonPlanetId: number, unitQuantities: Map<GameType.UnitType, number>): Promise<string | null>
{
    const clientRequest: APIEndPoint.RequestForAction<typeof APIEndPoint.ActionRequest.JumpGate> =
    {
        sourceMoonPlanetId: sourceMoonPlanetId,
        destinationMoonPlanetId: destinationMoonPlanetId,
        serializedUnitQuantities: Serialization.serializeNumberNumberMap(unitQuantities),
    };

    try
    {
        const response: APIEndPoint.ResponseForAction<typeof APIEndPoint.ActionRequest.JumpGate> = await ServerRequest.requestServerAction(APIEndPoint.ActionRequest.JumpGate, clientRequest);
        if (response.error !== null)
        {
            return response.error;
        }
        // Use != instead of !== here to catch everything that's very weird.
        if (response.serializedPlayerData == null)
        {
            return `Jump failed for moon ${sourceMoonPlanetId}: Invalid response from server.`;
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

export async function clientTrySetBuildingEnergySettingRequest(psController: CoreType.PSController, planetId: number, buildingType: GameType.BuildingType, energyPercentage: number): Promise<void>
{
    const clientRequest: APIEndPoint.RequestForAction<typeof APIEndPoint.ActionRequest.SetBuildingEnergySetting> =
    {
        planetId: planetId,
        buildingType: buildingType,
        energyPercentage: energyPercentage,
    };

    try
    {
        const response: APIEndPoint.ResponseForAction<typeof APIEndPoint.ActionRequest.SetBuildingEnergySetting> = await ServerRequest.requestServerAction(APIEndPoint.ActionRequest.SetBuildingEnergySetting, clientRequest);
        if (response.error !== null)
        {
            throw new Error(response.error);
        }
        // Use != instead of !== here to catch everything that's very weird.
        if (response.serializedPlayerData == null)
        {
            throw new Error(`Set building energy setting failed for planetId ${planetId}: Invalid response from server.`);
        }

        const playerData: CoreType.PlayerData = Serialization.deserializePlayerData(response.serializedPlayerData);
        await setPlayerState(psController, playerData);
    }
    catch (error: unknown)
    {
        console.error("⚠️:", error);
    }
}

export async function clientTrySendFleetRequest(psController: CoreType.PSController, originPlanetId: number, targetPlanetAddress: GameType.PlanetAddress, fleetAction: GameType.FleetActionType, unitQuantities: Map<GameType.UnitType, number>, resourceQuantities: Map<GameType.ResourceType, number>, speedPercentage?: number): Promise<string | null>
{
    const effectiveSpeedPercentage: number = speedPercentage ?? 100;

    const clientRequest: APIEndPoint.RequestForAction<typeof APIEndPoint.ActionRequest.SendFleet> =
    {
        originPlanetId: originPlanetId,
        targetPlanetGalaxy: targetPlanetAddress.galaxy,
        targetPlanetSystem: targetPlanetAddress.system,
        targetPlanetPosition: targetPlanetAddress.slot,
        targetPlanetZone: targetPlanetAddress.zone,
        fleetAction: fleetAction,
        serializedUnitQuantities: Serialization.serializeNumberNumberMap(unitQuantities),
        serializedResourceQuantities: Serialization.serializeNumberNumberMap(resourceQuantities),
        speedPercentage: effectiveSpeedPercentage,
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

export async function clientTryRecallFleetRequest(psController: CoreType.PSController, fleetId: number): Promise<void>
{
    const clientRequest: APIEndPoint.RequestForAction<typeof APIEndPoint.ActionRequest.RecallFleet> =
    {
        fleetId: fleetId,
    };

    try
    {
        const response: APIEndPoint.ResponseForAction<typeof APIEndPoint.ActionRequest.RecallFleet> = await ServerRequest.requestServerAction(APIEndPoint.ActionRequest.RecallFleet, clientRequest);
        if (response.error !== null)
        {
            throw new Error(response.error);
        }
        // Use != instead of !== here to catch everything that's very weird.
        if (response.serializedPlayerData == null)
        {
            throw new Error(`Recall fleet failed for fleetId ${fleetId}: Invalid response from server.`);
        }

        const playerData: CoreType.PlayerData = Serialization.deserializePlayerData(response.serializedPlayerData);
        await setPlayerState(psController, playerData);
    }
    catch (error: unknown)
    {
        console.error("⚠️:", error);
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

export async function clientTryRenamePlanetRequest(psController: CoreType.PSController, planetId: number, name: string): Promise<string | null>
{
    const clientRequest: APIEndPoint.RequestForAction<typeof APIEndPoint.ActionRequest.RenamePlanet> =
    {
        planetId: planetId,
        name: name,
    };

    try
    {
        const response: APIEndPoint.ResponseForAction<typeof APIEndPoint.ActionRequest.RenamePlanet> = await ServerRequest.requestServerAction(APIEndPoint.ActionRequest.RenamePlanet, clientRequest);
        if (response.error !== null)
        {
            throw new Error(response.error);
        }
        // Use != instead of !== here to catch everything that's very weird.
        if (response.serializedPlayerData == null)
        {
            throw new Error(`Rename planet failed for planetId ${planetId}: Invalid response from server.`);
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

export async function clientTryUpdatePlayerSettingsRequest(psController: CoreType.PSController, probesPerSend: number): Promise<string | null>
{
    const clientRequest: APIEndPoint.RequestForAction<typeof APIEndPoint.ActionRequest.UpdatePlayerSettings> =
    {
        probesPerSend: probesPerSend,
    };

    try
    {
        const response: APIEndPoint.ResponseForAction<typeof APIEndPoint.ActionRequest.UpdatePlayerSettings> = await ServerRequest.requestServerAction(APIEndPoint.ActionRequest.UpdatePlayerSettings, clientRequest);
        if (response.error !== null)
        {
            throw new Error(response.error);
        }
        // Use != instead of !== here to catch everything that's very weird.
        if (response.serializedPlayerData == null)
        {
            throw new Error(`Update player settings failed: Invalid response from server.`);
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
