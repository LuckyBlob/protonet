import * as SelectedPlanet from "@/lib/localStorage/selectedPlanet";
import * as PlayerDataType from "@/lib/playerData/playerDataTypes";
import * as ServerDataType from "@/lib/serverData/serverDataTypes";
import * as UseClientDataState from "@/lib/use/useClientDataState";
import * as PlayerDataSerialization from "@/lib/helper/serialization";
import * as ServerRequest from "@/lib/serverRequests/serverRequests";
import * as RequestType from "@/lib/serverRequests/requestTypes";
import * as LocalStorage from "@/lib/localStorage/localStorage"
import * as APIEndPoint from "@/app/api/apiEndPoints"

export async function fetchPlayerData(): Promise<PlayerDataType.PlayerData>
{
	const playerDataRequest: APIEndPoint.ResponseForData<typeof APIEndPoint.DataRequest.PlayerData> | null = await ServerRequest.requestServerData(APIEndPoint.DataRequest.PlayerData);
	if (playerDataRequest === null || playerDataRequest.serializedPlayerData == null)
	{
		throw Error(`Failed to fetch player data.`);
	}

	const playerData: PlayerDataType.PlayerData = PlayerDataSerialization.deserializePlayerData(playerDataRequest.serializedPlayerData);
	return playerData;
}

export function setSelectedPlanetID(psController: PlayerDataType.PSController, selectedPlanetId: number)
{
	const newPlayerState: PlayerDataType.PlayerState =
	{
		...psController[0],
		selectedPlanetId: selectedPlanetId,
	}
	SelectedPlanet.writeStoredSelectedPlanetId(selectedPlanetId);
	psController[1](newPlayerState);
}

function updateSelectedPlanetIdInStorage(psController: PlayerDataType.PSController, newPlayerData: PlayerDataType.PlayerData): number
{
	const currentlySelectedPlanetId: number = SelectedPlanet.readStoredSelectedPlanetId() ?? newPlayerData.fullPlanetDatas[0].planetRow.id;
	if (currentlySelectedPlanetId === psController[0].selectedPlanetId)
	{
		return currentlySelectedPlanetId;
	}

	SelectedPlanet.writeStoredSelectedPlanetId(currentlySelectedPlanetId);
	return currentlySelectedPlanetId;
}

export async function setPlayerState(psController: PlayerDataType.PSController, newPlayerData: PlayerDataType.PlayerData): Promise<PlayerDataType.PlayerData>
{
	const currentlySelectedPlanetId: number = updateSelectedPlanetIdInStorage(psController, newPlayerData);
	const loadedPlayerState: PlayerDataType.PlayerState =
	{
		dbData: newPlayerData,
		predictedDBData: newPlayerData,
		selectedPlanetId: currentlySelectedPlanetId,
		lastFetchTimestamp: Date.now(),
	};
	
	psController[1](loadedPlayerState);
	return newPlayerData;
}

export async function setPredictedPlayerState(psController: PlayerDataType.PSController, newPlayerData: PlayerDataType.PlayerData): Promise<PlayerDataType.PlayerData>
{
	const currentlySelectedPlanetId: number = updateSelectedPlanetIdInStorage(psController, newPlayerData);
	const loadedPlayerState: PlayerDataType.PlayerState =
	{
		dbData: psController[0].dbData,
		predictedDBData: newPlayerData,
		selectedPlanetId: currentlySelectedPlanetId,
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
		throw Error(`Failed to fetch player data.`);
	}
	setPlayerState(psController, playerData);
}

export async function fetchServerData(): Promise<ServerDataType.ServerData>
{
	const serverDataStateRequest: APIEndPoint.ResponseForData<typeof APIEndPoint.DataRequest.ServerConfig> | null = await ServerRequest.requestServerData(APIEndPoint.DataRequest.ServerConfig)
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
	const clientRequest: APIEndPoint.RequestForAction<typeof APIEndPoint.ActionRequest.UpgradeBuilding> = 
	{
		buildingType: buildingType,
		planetId: planetId,
	};
	const serverResponse: APIEndPoint.ResponseForAction<typeof APIEndPoint.ActionRequest.UpgradeBuilding> | null = await ServerRequest.requestServerAction(APIEndPoint.ActionRequest.UpgradeBuilding, clientRequest);
	if (serverResponse === null)
	{
        throw new Error(`Building upgrade failed for planetId ${planetId}: No response from server.`);
	}

	if (serverResponse.serializedPlayerData == null)
	{
        throw new Error(`Building upgrade failed for planetId ${planetId}: Invalid response from server.`);
	}

	const updatedPlayerData: PlayerDataType.PlayerData = PlayerDataSerialization.deserializePlayerData(serverResponse.serializedPlayerData);
	setPlayerState(psController, updatedPlayerData);
}

export async function tryBuildShipsClient(psController: PlayerDataType.PSController, planetId: number, shipQuantities: RequestType.ShipQuantityRequest[]): Promise<void>
{
	const clientRequest: APIEndPoint.RequestForAction<typeof APIEndPoint.ActionRequest.BuildShips> =
	{
		planetId: planetId,
		shipQuantities: shipQuantities,
	};
	const serverResponse: APIEndPoint.ResponseForAction<typeof APIEndPoint.ActionRequest.BuildShips> | null = await ServerRequest.requestServerAction(APIEndPoint.ActionRequest.BuildShips, clientRequest);
	if (serverResponse === null)
	{
		throw new Error(`Build ships failed for planetId ${planetId}: No response from server.`);
	}

	if (serverResponse.serializedPlayerData == null)
	{
		throw new Error(`Build ships failed for planetId ${planetId}: Invalid response from server.`);
	}

	const updatedPlayerData: PlayerDataType.PlayerData = PlayerDataSerialization.deserializePlayerData(serverResponse.serializedPlayerData);
	setPlayerState(psController, updatedPlayerData);
}

export async function tryRefreshServerData(clientDataStateResult: UseClientDataState.ClientDataStateResult): Promise<void>
{
	try
	{
		const serverResponse: APIEndPoint.ResponseForAction<typeof APIEndPoint.ActionRequest.RefreshServer> | null = await ServerRequest.requestServerAction(APIEndPoint.ActionRequest.RefreshServer, null);
		if (!serverResponse)
		{
			throw new Error(`Refresh server failed: No response from server.`);
		}

		if (serverResponse.error !== null)
		{
			throw new Error(`${serverResponse.error}`);
		}

		if (!serverResponse.serializedPlayerData)
		{
			throw new Error(`Refresh server failed: Invalid player data serialization.`);
		}
		
		if (!serverResponse.serverData)
		{
			throw new Error(`Refresh server failed: Invalid server data serialization.`);
		}

		if (!setPlayerState(clientDataStateResult.psController, PlayerDataSerialization.deserializePlayerData(serverResponse.serializedPlayerData)))
		{
			throw new Error(`Failed to set player data.`);
		}

		setServerData(clientDataStateResult.sdsController, serverResponse.serverData);
	}
	catch (error: unknown)
	{
		console.warn("⚠️:", error); 
	}
}