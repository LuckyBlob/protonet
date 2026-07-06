"use client";

import { ReactElement } from "react";

import * as UseClientDataState from "@/lib/use/useClientDataState";
import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as StaticDataHelper from "@/lib/gameplay/coreData/static/staticDataHelpers";
import * as ClientRequestFunctions from "@/lib/networkRequests/client/clientRequestFunctions";
import * as ErrorHelp from "@/lib/helper/errorHelp";
import * as HelperElements from "@/components/helpers/helperElements";

type AbandonPlanetButtonProps =
{
	clientDataStateResult: UseClientDataState.ClientDataStateResult;
};

export function AbandonPlanetButton(props: AbandonPlanetButtonProps): ReactElement
{
	const feedbackController: HelperElements.ActionFeedbackController = HelperElements.useActionFeedback();
	const playerData: CoreType.PlayerData = props.clientDataStateResult.psController[0].predictedDBData;
	const selectedPlanetId: number = props.clientDataStateResult.psController[0].selectedPlanetId;
	const selectedPlanetData: CoreType.PlanetData | null = CoreType.getPlanetDataForId(playerData.planetDatas, selectedPlanetId);
	const selectedZone: GameType.PlanetZone = selectedPlanetData !== null
		? (selectedPlanetData.planetRow.zone as GameType.PlanetZone)
		: GameType.PlanetZone.Planet;
	const planetZoneInfo: GameType.PlanetZoneInfo = StaticDataHelper.getPlanetZoneInfo(selectedZone);
	const zoneName: string = planetZoneInfo.displayName;

	const isPlanetZone: boolean = selectedZone === GameType.PlanetZone.Planet;
	const ownedPlanetCount: number = CoreType.getOwnedPlanets(playerData.planetDatas).length;
	const isDisabled: boolean = isPlanetZone === true && ownedPlanetCount <= 1;

	const handleAbandonPlanet = async (): Promise<void> =>
	{
		try
		{
			await ClientRequestFunctions.clientTryAbandonPlanet(props.clientDataStateResult.psController);
		}
		catch (error: unknown)
		{
			feedbackController.showError(ErrorHelp.getErrorMessage(error));
		}
	};

	const abandonDisabledReasons: string[] = isDisabled === true ? ["You cannot abandon your last planet."] : [];

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

	const tooltipButtonElement: ReactElement = HelperElements.renderWithTooltip(abandonDisabledReasons, buttonElement);

	const element: ReactElement =
	(
		<div className="flex flex-col items-center gap-1">
			{tooltipButtonElement}
			{HelperElements.renderActionFeedback(feedbackController)}
		</div>
	);

	return element;
}
