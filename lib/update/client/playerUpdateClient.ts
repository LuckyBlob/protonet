import * as GameType from "@/lib/gameplay/gameTypes";

import * as SelectedPlanet from "@/lib/localStorage/selectedPlanet";

import * as BuyRequest from "@/lib/requestTypes/buyRequests";

import * as PlayerDataType from "@/lib/playerData/playerDataTypes";

import * as ServerDataType from "@/lib/serverData/serverDataTypes";

import * as UseClientDataState from "@/lib/use/useClientDataState";

export async function fetchAndSetPlayerState(psController: PlayerDataType.PSController): Promise<void>
{
	const response: Response = await fetch("/api/playerData");

	if (response.ok === false)
	{
		return;
	}

	const playerData: PlayerDataType.PlayerData = await response.json();

	const storedId: number | null = SelectedPlanet.readStoredSelectedPlanetId();
	const resolvedId: number | null = SelectedPlanet.resolveSelectedPlanetId(playerData.planetRows, storedId);

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

export async function tryBuyBuildingUpgradeClient(psController: PlayerDataType.PSController, planetId: number): Promise<void>
{
	const requestBody: BuyRequest.BuildingUpgradeRequest =
	{
		buildingType: GameType.BUILDING_PRODUCTION_RESSOURCE_1,
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

	const updatedPlayerData: PlayerDataType.PlayerData = await response.json();
	const updatedPlayerState: PlayerDataType.PlayerState =
	{
		dbData: updatedPlayerData,
		predictedDBData: updatedPlayerData,
		selectedPlanetId: SelectedPlanet.resolveSelectedPlanetId(updatedPlayerData.planetRows, SelectedPlanet.readStoredSelectedPlanetId()) ?? updatedPlayerData.planetRows[0].id,
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