import { PlayerRow } from "@/lib/dbTypes";

import * as MainPageTypes from "@/lib/mainPageTypes";

export async function fetchAndSetPlayerState(psController: MainPageTypes.PSController, playerId: number): Promise<void>
{
	const response: Response = await fetch("/api/state");
	const playerRow: PlayerRow = await response.json();

	const playerState: MainPageTypes.PlayerState =
	{
		dbData: playerRow,
		lastFetchTimestamp: Date.now(),
		currentPredictedValues: { gold: playerRow.gold },
	};

	psController[1](playerState);
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