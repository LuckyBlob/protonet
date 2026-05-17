"use client";

import * as PlanetProgress from "@/lib/gameplay/planetProgress";
import * as SelectedPlanet from "@/lib/localStorage/selectedPlanet";
import * as PlayerDataType from "@/lib/playerData/playerDataTypes";
import * as UseClientDataState from "@/lib/use/useClientDataState";
import * as ClientUpdate from "@/lib/update/client/clientUpdate";
import * as PlanetData from "@/lib/playerData/planetData";

export function updatePlanetPredictedData(clientDataStateResult: UseClientDataState.ClientDataStateResult): void
{
	const playerState: PlayerDataType.PlayerState = clientDataStateResult.psController[0];
	const selectedPlanetPredicted: PlanetData.FullPlanetData = SelectedPlanet.getSelectedFullPlanetDataPredicted(playerState);

	const now: number = Date.now();

	if (!PlanetProgress.hasAnyBuildingFinishedSinceLastUpdate(selectedPlanetPredicted, now))
	{
		return;
	}
	const advancedFullPlanetData: PlanetData.FullPlanetData = PlanetProgress.applyPlanetProgress(selectedPlanetPredicted, clientDataStateResult.sdsController[0], now);
	const updatedFullPlanetDatas: PlanetData.FullPlanetData[] = ClientUpdate.replaceFullPlanetDataInArrayByUpdatedFullPlanetData(playerState.predictedDBData.fullPlanetDatas, advancedFullPlanetData);

	const updatedPlayerState: PlayerDataType.PlayerState =
	{
		...playerState,
		predictedDBData:
		{
			...playerState.predictedDBData,
			fullPlanetDatas: updatedFullPlanetDatas,
		},
	};

	clientDataStateResult.psController[1](updatedPlayerState);
}