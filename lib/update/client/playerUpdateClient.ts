import * as SelectedPlanet from "@/lib/localStorage/selectedPlanet";
import * as PlayerDataType from "@/lib/playerData/playerDataTypes";
import * as ServerDataType from "@/lib/serverData/serverDataTypes";
import * as UseClientDataState from "@/lib/use/useClientDataState";
import * as PlayerDataSerialization from "@/lib/playerData/playerDataSerialization";
import * as ServerRequest from "@/lib/serverRequests/serverRequests";
import * as RequestType from "@/lib/serverRequests/requestTypes";
import { DataRequest, ActionRequest } from "@/app/api/apiEndPoints"

export async function fetchPlayerData(): Promise<PlayerDataType.PlayerData>
{
	const playerDataRequest: RequestType.PlayerDataRequest | null = await ServerRequest.requestServerData(DataRequest.PlayerData);
	if (playerDataRequest === null || playerDataRequest.serializedPlayerData == null)
	{
		throw Error(`Failed to fetch player data.`)
	}

	const playerData: PlayerDataType.PlayerData = PlayerDataSerialization.deserializePlayerData(playerDataRequest.serializedPlayerData);
	return playerData;
}

async function setPlayerData(psController: PlayerDataType.PSController, newPlayerData: PlayerDataType.PlayerData): Promise<PlayerDataType.PlayerData>
{
	let selectedPlanetId: number | null = SelectedPlanet.updateStoredSelectedPlanetId(newPlayerData);
	try
	{
		if (selectedPlanetId === null)
		{
			throw Error(`Couldnt resolve selected planet ID.`)
		}
	}
	catch (error: unknown)
	{
		selectedPlanetId = newPlayerData.fullPlanetDatas[0].planetRow.id;
	}

	const loadedPlayerState: PlayerDataType.PlayerState =
	{
		dbData: newPlayerData,
		predictedDBData: newPlayerData,
		selectedPlanetId: selectedPlanetId,
		lastFetchTimestamp: Date.now(),
	};

	psController[1](loadedPlayerState);
	return newPlayerData;
}

export async function fetchAndSetPlayerData(psController: PlayerDataType.PSController): Promise<void>
{
	const playerData: PlayerDataType.PlayerData | null = await fetchPlayerData();
	if (playerData === null)
	{
		throw Error(`Failed to fetch player data.`)
	}
	setPlayerData(psController, playerData);
}

export async function fetchServerData(): Promise<ServerDataType.ServerData>
{
	const serverDataStateRequest: RequestType.ServerDataStateRequest | null = await ServerRequest.requestServerData(DataRequest.ServerConfig)
	if (serverDataStateRequest === null || serverDataStateRequest.serverData == null)
	{
		throw Error(`Failed to fetch server data.`)
	}

	return serverDataStateRequest.serverData;
}

export async function setServerData(sdsController: ServerDataType.SDSController, serverData: ServerDataType.ServerData): Promise<void>
{
	sdsController[1](serverData);
}

export async function fetchAndSetServerData(sdsController: ServerDataType.SDSController): Promise<void>
{
	const serverData: ServerDataType.ServerData | null = await fetchServerData();
	if (serverData == null)
	{
		throw Error(`Failed to fetch server data.`)
	}
	setServerData(sdsController, serverData);
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
	}

	if (serverResponse.serializedPlayerData == null)
	{
        throw new Error(`Building upgrade failed for planetId ${planetId}: Invalid response from server.`);
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
	const serverResponse: RequestType.RefreshServer_ServerResponse | null = await ServerRequest.requestServerAction(ActionRequest.RefreshServer);
	if (serverResponse === null)
	{
        throw new Error(`Refresh server failed: No response from server.`);
	}

	if (!serverResponse.serializedPlayerData || !serverResponse.serverData)
	{
        throw new Error(`Refresh server failed: Invalid response from server.`);
	}

	if (!setPlayerData(clientDataStateResult.psController, PlayerDataSerialization.deserializePlayerData(serverResponse.serializedPlayerData)))
	{
		throw new Error(`Failed to set player data.`);
	}

	setServerData(clientDataStateResult.sdsController, serverResponse.serverData);
}