import * as SelectedPlanet from "@/lib/localStorage/selectedPlanet";
import * as BuyRequest from "@/lib/requestTypes/buyRequests";
import * as PlayerDataType from "@/lib/playerData/playerDataTypes";
import * as ServerDataType from "@/lib/serverData/serverDataTypes";
import * as UseClientDataState from "@/lib/use/useClientDataState";
import * as PlayerDataSerialization from "@/lib/playerData/playerDataSerialization";

export async function fetchAndSetPlayerState(psController: PlayerDataType.PSController): Promise<void>
{
	const response: Response = await fetch("/api/playerData");
	if (response.ok === false)
	{
		return;
	}

	const serializedPlayerData: PlayerDataSerialization.SerializedPlayerData = await response.json();
	const playerData: PlayerDataType.PlayerData = PlayerDataSerialization.deserializePlayerData(serializedPlayerData);

	const storedId: number | null = SelectedPlanet.readStoredSelectedPlanetId();
	const resolvedId: number | null = SelectedPlanet.resolveSelectedPlanetId(playerData.fullPlanetDatas, storedId);

	if (resolvedId === null)
	{
		return;
	}
	SelectedPlanet.writeStoredSelectedPlanetId(resolvedId);

	const loadedPlayerState: PlayerDataType.PlayerState =
	{
		dbData: playerData,
		predictedDBData: playerData,
		selectedPlanetId: resolvedId,
		lastFetchTimestamp: Date.now(),
	};

	psController[1](loadedPlayerState);
}

export async function fetchAndSetServerData(sdsController: ServerDataType.SDSController): Promise<void>
{
	const response: Response = await fetch("/api/serverDataState");

	if (response.ok === false)
	{
		return;
	}

	const serverData: ServerDataType.ServerData = await response.json();
	sdsController[1](serverData);
}

export async function tryBuyBuildingUpgradeClient(psController: PlayerDataType.PSController, planetId: number, buildingType: number): Promise<void>
{
	const requestBody: BuyRequest.BuildingUpgradeRequest =
	{
		buildingType: buildingType,
		planetId: planetId,
	};

	const response: Response = await fetch("/api/buy/buildingLevel", {
		method: "POST",
		headers:
		{
			"Content-Type": "application/json",
		},
		body: JSON.stringify(requestBody),
	});
	if (response.ok === false)
	{
		return;
	}

	const serializedPlayerData: PlayerDataSerialization.SerializedPlayerData = await response.json();
	const updatedPlayerData: PlayerDataType.PlayerData = PlayerDataSerialization.deserializePlayerData(serializedPlayerData);

	const updatedPlayerState: PlayerDataType.PlayerState =
	{
		dbData: updatedPlayerData,
		predictedDBData: updatedPlayerData,
		selectedPlanetId: SelectedPlanet.resolveSelectedPlanetId(updatedPlayerData.fullPlanetDatas, SelectedPlanet.readStoredSelectedPlanetId()) ?? updatedPlayerData.fullPlanetDatas[0].planetRow.id,
		lastFetchTimestamp: Date.now(),
	};

	psController[1](updatedPlayerState);
}

export async function tryRefreshServerData(clientDataStateResult: UseClientDataState.ClientDataStateResult): Promise<void>
{
	const response: Response = await fetch("/api/refreshServerData", { method: "POST" });

	if (response.ok === false)
	{
		return;
	}

	await fetchAndSetPlayerState(clientDataStateResult.psController);
	await fetchAndSetServerData(clientDataStateResult.sdsController);
}