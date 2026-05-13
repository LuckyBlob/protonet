import { PlayerRow } from "@/lib/dbTypes";

import * as MainPageTypes from "@/lib/mainPageTypes";
import * as ServerDataTypes from "@/lib/serverDataTypes";

export async function fetchAndSetPlayerState(psController: MainPageTypes.PSController, playerId: number): Promise<void>
{
	const response: Response = await fetch("/api/playerState");
	const playerRow: PlayerRow = await response.json();

	const playerState: MainPageTypes.PlayerState =
	{
		dbData: playerRow,
		lastFetchTimestamp: Date.now(),
		currentPredictedValues: { gold: playerRow.gold },
	};

	psController[1](playerState);
}

export async function fetchAndSetServerData(sdsController: MainPageTypes.SDSController): Promise<void>
{
	const response: Response = await fetch("/api/serverDataState");
	const serverData: ServerDataTypes.ServerData = await response.json();

	sdsController[1](serverData);
}

export async function tryBuyUpgrade(psController: MainPageTypes.PSController): Promise<void>
{
	const response: Response = await fetch("/api/buyUpgrade", { method: "POST" });

	if (response.ok === false)
	{
		return;
	}

	const updatedPlayerRow: PlayerRow = await response.json();

	const playerState: MainPageTypes.PlayerState =
	{
		dbData: updatedPlayerRow,
		lastFetchTimestamp: Date.now(),
		currentPredictedValues: { gold: updatedPlayerRow.gold },
	};
	psController[1](playerState);
}

export async function tryRefreshServerData(psController: MainPageTypes.PSController, sdsController: MainPageTypes.SDSController): Promise<void>
{
	const response: Response = await fetch("/api/refreshServerData", { method: "POST" });

	if (response.ok === false)
	{
		return;
	}

	await fetchAndSetPlayerState(psController, 1);
	await fetchAndSetServerData(sdsController);
}