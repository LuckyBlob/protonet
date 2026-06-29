"use client";

import { ReactElement } from "react";

import * as UseClientDataState from "@/lib/use/useClientDataState";
import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as StaticDataHelper from "@/lib/gameplay/coreData/static/staticDataHelpers";
import * as ClientRequestFunctions from "@/lib/networkRequests/client/clientRequestFunctions";

type AbandonPlanetButtonProps =
{
	clientDataStateResult: UseClientDataState.ClientDataStateResult;
};

export function AbandonPlanetButton(props: AbandonPlanetButtonProps): ReactElement
{
	const playerData: CoreType.PlayerData = props.clientDataStateResult.psController[0].predictedDBData;
	const selectedPlanetId: number = props.clientDataStateResult.psController[0].selectedPlanetId;
	const selectedPlanetData: CoreType.PlanetData | null = CoreType.getPlanetDataForId(playerData.planetDatas, selectedPlanetId);
	const selectedZone: GameType.PlanetZone = selectedPlanetData !== null
		? (selectedPlanetData.planetRow.zone as GameType.PlanetZone)
		: GameType.PlanetZone.Planet;
	const planetZoneInfo: GameType.PlanetZoneInfo = StaticDataHelper.getPlanetZoneInfo(selectedZone);
	const zoneName: string = planetZoneInfo.displayName;

	// Only abandoning a planet (which also takes its moon/debris) is gated by the one-planet floor;
	// abandoning a moon/debris leaves the planet count untouched, so it stays enabled.
	const isPlanetZone: boolean = selectedZone === GameType.PlanetZone.Planet;
	const ownedPlanetCount: number = CoreType.getOwnedPlanets(playerData.planetDatas).length;
	const isDisabled: boolean = isPlanetZone === true && ownedPlanetCount <= 1;

	const handleAbandonPlanet = async (): Promise<void> =>
	{
		const errorMessage: string | null = await ClientRequestFunctions.clientTryAbandonPlanet(props.clientDataStateResult.psController);
		if (errorMessage !== null)
		{
			console.error("⚠️:", errorMessage);
		}
	};

	const buttonElement: ReactElement =
	(
		<button
			type="button"
			onClick={handleAbandonPlanet}
			disabled={isDisabled}
			className="border border-gray-400 px-3 py-1 rounded bg-red-600 hover:bg-red-500 disabled:bg-gray-400 disabled:cursor-not-allowed text-white text-sm font-semibold"
		>
			Abandon {zoneName}
		</button>
	);

	return buttonElement;
}
