import * as MainPageType from "@/lib/mainPageTypes";

import * as GameView from "@/components/views/gameView";
import * as StatsView from "@/components/views/statsView";
import * as UpgradeView from "@/components/views/upgradeView";

import * as UseLoadClientDataState from "@/lib/use/useLoadClientDataState";

type MainWindowProps =
{
	cvController: MainPageType.CVController;
	clientDataStateResult: UseLoadClientDataState.ClientDataStateResult;
};

export function MainWindowElement(props: MainWindowProps): React.ReactElement
{
	if (props.cvController[0] === "game")
	{
		return <GameView.GameView clientDataStateResult={props.clientDataStateResult} />;
	}

	if (props.cvController[0] === "upgrades")
	{
		return <UpgradeView.UpgradeView clientDataStateResult={props.clientDataStateResult} />;
	}

	if (props.cvController[0] === "stats")
	{
		return <StatsView.StatsView clientDataStateResult={props.clientDataStateResult} />;
	}

	return <div>Unknown view</div>;
}