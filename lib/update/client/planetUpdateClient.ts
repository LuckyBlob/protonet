"use client";

import * as SelectedPlanet from "@/lib/localStorage/selectedPlanet";
import * as PlanetProgress from "@/lib/gameplay/planetProgress";
import * as ClientUpdate from "@/lib/update/client/clientUpdate";
import * as UseLoadClientDataState from "@/lib/use/useLoadClientDataState";
import * as PlayerDataType from "@/lib/playerData/playerDataTypes"
import * as DBType from "@/lib/db/dbTypes"

export function updatePlanetPredictedData(clientDataStateResult: UseLoadClientDataState.ClientDataStateResult): void
{
	const playerState: PlayerDataType.PlayerState = clientDataStateResult.psController[0];
	const selectedPlanet: DBType.PlanetRow = SelectedPlanet.getSelectedPlanetRow(playerState);

	const now: number = Date.now();
	const advancedPlanetRow: DBType.PlanetRow = PlanetProgress.applyPlanetProgress(selectedPlanet, clientDataStateResult.sdsController[0], now, true);

	console.log("updatePlanetPredictedData", {
    last_updated: selectedPlanet.last_updated,
    buildCompletesAt: selectedPlanet.building_upgrade_completes_at,
    now,
    sameRef: advancedPlanetRow === selectedPlanet,
});

	// applyPlanetProgress returns the same reference when nothing changed
	// (elapsed <= 0). Return prev unchanged so React skips the update.
	if (advancedPlanetRow === selectedPlanet)
	{
		return;
	}

	console.log("applied!");
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