import { ReactElement } from "react";

import * as GameView from "@/components/views/gameView";
import * as StatsView from "@/components/views/statsView";
import * as BuildingView from "@/components/views/buildingView";
import * as ResearchView from "@/components/views/researchView";
import * as ShipyardView from "@/components/views/shipyardView";
import * as FleetView from "@/components/views/fleetView";
import * as PlanetView from "@/components/views/planetView";
import * as CurrentPlanetView from "@/components/views/currentPlanetView";
import * as MessagesView from "@/components/views/messagesView";
import * as AccountView from "@/components/views/accountView";
import * as UseClientDataState from "@/lib/use/useClientDataState";
import * as UseCurrentView from "@/lib/use/useCurrentView";
import * as UseCurrentUser from "@/lib/use/useCurrentUser";

type MainWindowProps =
{
	cvController: UseCurrentView.CVController;
	clientDataStateResult: UseClientDataState.ClientDataStateResult;
	cuController: UseCurrentUser.CUController;
};

export function MainWindowElement(props: MainWindowProps): ReactElement
{
	if (props.cvController[0] === "game")
	{
		return <GameView.GameView clientDataStateResult={props.clientDataStateResult} />;
	}

	if (props.cvController[0] === "buildings")
	{
		return <BuildingView.BuildingView clientDataStateResult={props.clientDataStateResult} />;
	}

	if (props.cvController[0] === "research")
	{
		return <ResearchView.ResearchView clientDataStateResult={props.clientDataStateResult} />;
	}

	if (props.cvController[0] === "shipyard")
	{
		return <ShipyardView.ShipyardView clientDataStateResult={props.clientDataStateResult} />;
	}

	if (props.cvController[0] === "fleets")
	{
		return <FleetView.FleetView clientDataStateResult={props.clientDataStateResult} />;
	}

	if (props.cvController[0] === "stats")
	{
		return <StatsView.StatsView clientDataStateResult={props.clientDataStateResult} />;
	}

	if (props.cvController[0] === "currentPlanet")
	{
		return <CurrentPlanetView.CurrentPlanetView clientDataStateResult={props.clientDataStateResult} />;
	}

	if (props.cvController[0] === "planets")
	{
		return <PlanetView.PlanetView clientDataStateResult={props.clientDataStateResult} />;
	}

	if (props.cvController[0] === "messages")
	{
		return <MessagesView.MessagesView clientDataStateResult={props.clientDataStateResult} />;
	}

	if (props.cvController[0] === "account")
	{
		return <AccountView.AccountView clientDataStateResult={props.clientDataStateResult} cuController={props.cuController} />;
	}

	return <div>Unknown view</div>;
}