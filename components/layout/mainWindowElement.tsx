import * as GameView from "@/components/views/gameView";
import * as StatsView from "@/components/views/statsView";
import * as UpgradeView from "@/components/views/upgradeView";

import * as UseClientDataState from "@/lib/use/useClientDataState";
import * as UseCurrentView from "@/lib/use/useCurrentView";

type MainWindowProps =
{
	cvController: UseCurrentView.CVController;
	clientDataStateResult: UseClientDataState.ClientDataStateResult;
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