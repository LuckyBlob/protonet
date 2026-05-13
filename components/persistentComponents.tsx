import * as MainPageTypes from "@/lib/mainPageTypes";

import { GameView } from "@/components/views/gameView";
import { UpgradeView } from "@/components/views/upgradeView";
import { StatsView } from "@/components/views/statsView";
import { formatRemainingTimeMs } from "@/lib/timeFormat";

type ChildrenProps =
{
	children: React.ReactNode;
};

export function BackgroundElement(props: ChildrenProps): React.ReactElement
{
	const backgroundElement: React.ReactElement =
	(
        <div
        className="min-h-screen flex flex-col bg-center bg-repeat"
        style=
        {{
            backgroundImage: "url('/background.png')",
            backgroundSize: "600px 600px",
        }}>
            {props.children}
        </div>
	);

	return backgroundElement;
}

type SideBarProps =
{
	username: string;
	currentView: string;
    admin_level: number | null;
	onSelectView: (viewName: string) => void;
	onLogout: () => void;
    onRefreshServerData: () => void;
};

export function SideBarElement(props: SideBarProps): React.ReactElement
{
    const navButtonClass: string = "px-4 py-1 text-center hover:bg-white/10 rounded transition-colors";

	const adminSection: React.ReactElement | null = props.admin_level === 0
		?
		(
			<button
				onClick={props.onRefreshServerData}
				className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded w-full mb-2"
			>
				Refresh Server Data
			</button>
		)
		: null;

	const sideBarElement: React.ReactElement =
	(
		<div className="w-[200px] bg-black/50 text-white pt-[300px] pb-8 px-4 flex flex-col items-center min-h-screen">
			<div className="text-sm text-gray-300 mb-12">
				{props.username}
			</div>

            <div className="flex flex-col gap-0 w-full">
                <button onClick={() => props.onSelectView("game")} className={navButtonClass}>Game</button>
                <button onClick={() => props.onSelectView("upgrades")} className={navButtonClass}>Upgrades</button>
                <button onClick={() => props.onSelectView("stats")} className={navButtonClass}>Stats</button>
            </div>

			<div className="flex-1" />

            {adminSection}

			<button
				onClick={props.onLogout}
				className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded w-full"
			>
				Log out
			</button>
		</div>
	);

	return sideBarElement;
}

type TopBarProps =
{
	gold: number;
	productionRate: number;
	buildCompletesAt: number;  // 0 if no build active
};

export function TopBarElement(props: TopBarProps): React.ReactElement
{
	const isBuilding: boolean = props.buildCompletesAt !== 0;
	const remainingMs: number = props.buildCompletesAt - Date.now();
	const buildHintText: string = isBuilding === true ? ` (${formatRemainingTimeMs(remainingMs)})` : "";

	const topBarElement: React.ReactElement =
	(
		<div className="h-[70px] bg-black/50 text-white pt-5 px-4 flex justify-center items-start">
			<div className="flex gap-8">
				<div>💰Gold: {props.gold}</div>
				<div>⚡Rate: {props.productionRate}/h{buildHintText}</div>
			</div>
		</div>
	);

	return topBarElement;
}

type MainWindowProps =
{
	currentView: string;
	psController: MainPageTypes.PSController;
	sdsController: MainPageTypes.SDSController;
};

export function MainWindowElement(props: MainWindowProps): React.ReactElement
{
	if (props.currentView === "game")
	{
		return <GameView psController={props.psController} />;
	}

	if (props.currentView === "upgrades")
	{
		return <UpgradeView psController={props.psController} sdsController={props.sdsController} />;
	}

	if (props.currentView === "stats")
	{
		return <StatsView psController={props.psController} />;
	}

	return <div>Unknown view</div>;
}

type GameLayoutProps =
{
	sideBar: React.ReactNode;
	topBar: React.ReactNode;
	mainWindow: React.ReactNode;
};

export function GameLayoutElement(props: GameLayoutProps): React.ReactElement
{
	const layoutElement: React.ReactElement =
	(
		<BackgroundElement>
			<div className="min-h-screen flex">
				{props.sideBar}
				<div className="flex-1 flex flex-col">
					{props.topBar}
					<main className="flex-1 flex items-center justify-center p-8">
						{props.mainWindow}
					</main>
				</div>
			</div>
		</BackgroundElement>
	);

	return layoutElement;
}