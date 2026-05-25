import { ReactElement } from "react";

import * as GameView from "@/components/views/gameView";
import * as StatsView from "@/components/views/statsView";
import * as UpgradeView from "@/components/views/upgradeView";
import * as ShipyardView from "@/components/views/shipyardView";
import * as ShipView from "@/components/views/shipView";
import * as UseClientDataState from "@/lib/use/useClientDataState";
import * as UseCurrentView from "@/lib/use/useCurrentView";

type MainWindowProps =
{
	cvController: UseCurrentView.CVController;
	clientDataStateResult: UseClientDataState.ClientDataStateResult;
};

export function MainWindowElement(props: MainWindowProps): ReactElement
{
	if (props.cvController[0] === "game")
	{
		return <GameView.GameView clientDataStateResult={props.clientDataStateResult} />;
	}

	if (props.cvController[0] === "upgrades")
	{
		return <UpgradeView.UpgradeView clientDataStateResult={props.clientDataStateResult} />;
	}

	if (props.cvController[0] === "shipyard")
	{
		return <ShipyardView.ShipyardView clientDataStateResult={props.clientDataStateResult} />;
	}

	if (props.cvController[0] === "ships")
	{
		return <ShipView.ShipView clientDataStateResult={props.clientDataStateResult} />;
	}

	if (props.cvController[0] === "stats")
	{
		return <StatsView.StatsView clientDataStateResult={props.clientDataStateResult} />;
	}

	return <div>Unknown view</div>;
}