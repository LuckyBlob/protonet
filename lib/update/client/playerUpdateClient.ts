import * as SelectedPlanet from "@/lib/localStorage/selectedPlanet";
import * as PlayerDataType from "@/lib/playerData/playerDataTypes";
import * as ServerDataType from "@/lib/serverData/serverDataTypes";
import * as UseClientDataState from "@/lib/use/useClientDataState";
import * as PlayerDataSerialization from "@/lib/playerData/playerDataSerialization";
import * as ServerRequest from "@/lib/serverRequests/serverRequests";
import * as RequestType from "@/lib/serverRequests/requestTypes";
import { DataRequest, ActionRequest } from "@/app/api/apiEndPoints"

export async function fetchAndSetPlayerState(psController: PlayerDataType.PSController): Promise<boolean>
{
	const playerDataRequest: RequestType.PlayerDataRequest | null = await ServerRequest.requestServerData(DataRequest.PlayerData);
	if (playerDataRequest === null || playerDataRequest.serializedPlayerData == null)
	{
		return false;
	}

	const playerData: PlayerDataType.PlayerData = PlayerDataSerialization.deserializePlayerData(playerDataRequest.serializedPlayerData);
	const selectedPlanetId: number | null = SelectedPlanet.updateStoredSelectedPlanetId(playerData);
	if (selectedPlanetId === null)
	{
		return false;
	}

	const loadedPlayerState: PlayerDataType.PlayerState =
	{
		dbData: playerData,
		predictedDBData: playerData,
		selectedPlanetId: selectedPlanetId,
		lastFetchTimestamp: Date.now(),
	};

	psController[1](loadedPlayerState);
	return true;
}

export async function fetchAndSetServerData(sdsController: ServerDataType.SDSController): Promise<boolean>
{
	const serverDataStateRequest: RequestType.ServerDataStateRequest | null = await ServerRequest.requestServerData(DataRequest.ServerConfig)
	if (serverDataStateRequest === null || serverDataStateRequest.serverData == null)
	{
		return false;
	}

	sdsController[1](serverDataStateRequest.serverData);
	return true;
}

export async function tryBuyBuildingUpgradeClient(psController: PlayerDataType.PSController, planetId: number, buildingType: number): Promise<void>
{
	const clientRequest: RequestType.BuildingUpgrade_ClientRequest =
	{
		buildingType: buildingType,
		planetId: planetId,
	};
	const serverResponse: RequestType.BuildingUpgrade_ServerResponse | null = await ServerRequest.requestServerAction(ActionRequest.UpgradeBuilding, clientRequest);
	if (serverResponse === null)
	{
        throw new Error(`Building upgrade failed for planetId ${planetId}: No response from server.`);
		return;
	}

	if (serverResponse.serializedPlayerData == null)
	{
        throw new Error(`Building upgrade failed for planetId ${planetId}: Invalid response from server.`);
		return;
	}

	const updatedPlayerData: PlayerDataType.PlayerData = PlayerDataSerialization.deserializePlayerData(serverResponse.serializedPlayerData);

	const updatedPlayerState: PlayerDataType.PlayerState =
	{
		dbData: updatedPlayerData,
		predictedDBData: updatedPlayerData,
		selectedPlanetId: psController[0].selectedPlanetId,
		lastFetchTimestamp: Date.now(),
	};

	psController[1](updatedPlayerState);
}

export async function tryRefreshServerData(clientDataStateResult: UseClientDataState.ClientDataStateResult): Promise<void>
{
	await ServerRequest.requestServerAction(ActionRequest.RefreshServer);
	await fetchAndSetPlayerState(clientDataStateResult.psController);
	await fetchAndSetServerData(clientDataStateResult.sdsController);
}