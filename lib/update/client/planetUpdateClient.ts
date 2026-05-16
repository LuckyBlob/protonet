"use client";

import * as DBType from "@/lib/db/dbTypes";

import * as PlanetProgress from "@/lib/gameplay/planetProgress";

import * as SelectedPlanet from "@/lib/localStorage/selectedPlanet";

import * as PlayerDataType from "@/lib/playerData/playerDataTypes";

import * as UseClientDataState from "@/lib/use/useClientDataState";

import * as ClientUpdate from "@/lib/update/client/clientUpdate";

export function updatePlanetPredictedData(clientDataStateResult: UseClientDataState.ClientDataStateResult): void
{
	const playerState: PlayerDataType.PlayerState = clientDataStateResult.psController[0];
	const selectedPlanet: DBType.PlanetRow = SelectedPlanet.getSelectedPlanetRow(playerState);

	const now: number = Date.now();
	const advancedPlanetRow: DBType.PlanetRow = PlanetProgress.applyPlanetProgress(selectedPlanet, clientDataStateResult.sdsController[0], now, true);

	if (advancedPlanetRow === selectedPlanet)
	{
		return;
	}

	const updatedPlanetRows: DBType.PlanetRow[] = ClientUpdate.replacePlanetRowInArrayByUpdatedPlanetRow(playerState.predictedDBData.planetRows, advancedPlanetRow);

	const updatedPlayerState: PlayerDataType.PlayerState =
	{
		...playerState,
		predictedDBData:
		{
			...playerState.predictedDBData,
			planetRows: updatedPlanetRows,
		},
	};

	clientDataStateResult.psController[1](updatedPlayerState);
}