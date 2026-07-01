import { useRouter } from "next/navigation";
import { ReactElement, ReactNode } from "react";

import * as UseClientDataState from "@/lib/use/useClientDataState";
import * as UseCurrentView from "@/lib/use/useCurrentView";
import * as UseCurrentUser from "@/lib/use/useCurrentUser";
import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as MessageData from "@/lib/gameplay/dynamicData/player/messageData";
import * as SelectedPlanet from "@/lib/localStorage/selectedPlanet";
import * as BuildingData from "@/lib/gameplay/dynamicData/planet/buildingData";
import * as UnitData from "@/lib/gameplay/dynamicData/planet/unitData";

type SideBarProps =
{
	cuController: UseCurrentUser.CUController;
	cvController: UseCurrentView.CVController;
	clientDataStateResult: UseClientDataState.ClientDataStateResult;
	router: ReturnType<typeof useRouter>;
	onLogout: (router: ReturnType<typeof useRouter>) => void;
	onRefreshServerData: (clientDataStateResult: UseClientDataState.ClientDataStateResult) => void;
};

type NavItem =
{
	view: string;
	label: ReactNode;
	subItems: NavItem[];
};

function buildBuildingSubItems(clientDataStateResult: UseClientDataState.ClientDataStateResult): NavItem[]
{
	const buildingSubItems: NavItem[] =
	[
	    { view: "buildings", label: "Upgrade", subItems: [] },
	    { view: "buildingsDeconstruct", label: "Deconstruct", subItems: [] },
	];

	if (getSelectedPlanetBuildingLevel(clientDataStateResult, GameType.BuildingType.MissileSilo) >= 1)
	{
	    buildingSubItems.push({ view: "missileSilo", label: "Missile Silo", subItems: [] });
	}

	if (getSelectedPlanetBuildingLevel(clientDataStateResult, GameType.BuildingType.SensorPhalanx) >= 1)
	{
	    buildingSubItems.push({ view: "sensorPhalanx", label: "Sensor Phalanx", subItems: [] });
	}

	if (getSelectedPlanetBuildingLevel(clientDataStateResult, GameType.BuildingType.JumpGate) >= 1)
	{
	    buildingSubItems.push({ view: "jumpGate", label: "Jump Gate", subItems: [] });
	}

	if (getSelectedPlanetBuildingLevel(clientDataStateResult, GameType.BuildingType.RepairDock) >= 1)
	{
	    buildingSubItems.push({ view: "repairDock", label: "Repair Dock", subItems: [] });
	}

	return buildingSubItems;
}

function buildFleetSubItems(clientDataStateResult: UseClientDataState.ClientDataStateResult): NavItem[]
{
	const fleetSubItems: NavItem[] =
	[
	    { view: "fleets", label: "Ships", subItems: [] },
	];

	if (getSelectedPlanetCategoryUnitQuantity(clientDataStateResult, GameType.UnitCategory.Missile) >= 1)
	{
	    fleetSubItems.push({ view: "fleetsMissiles", label: "Missiles", subItems: [] });
	}

	return fleetSubItems;
}

function buildPlanetSubItems(): NavItem[]
{
	const planetSubItems: NavItem[] =
	[
	    { view: "planets", label: "Galaxy", subItems: [] },
	    { view: "currentPlanet", label: "Current Planet", subItems: [] },
	];

	return planetSubItems;
}

function buildNavItems(clientDataStateResult: UseClientDataState.ClientDataStateResult, messagesLabel: ReactNode): NavItem[]
{
	const navItems: NavItem[] =
	[
	    { view: "game", label: "Game", subItems: [] },
	    { view: "buildings", label: "Buildings", subItems: buildBuildingSubItems(clientDataStateResult) },
	    { view: "research", label: "Research", subItems: [] },
	    { view: "shipyard", label: "Shipyard", subItems: [] },
	    { view: "fleets", label: "Fleets", subItems: buildFleetSubItems(clientDataStateResult) },
	    { view: "planets", label: "Planets", subItems: buildPlanetSubItems() },
	    { view: "messages", label: messagesLabel, subItems: [] },
	    { view: "stats", label: "Stats", subItems: [] },
	    { view: "settings", label: "Player Settings", subItems: [] },
	];

	return navItems;
}

export function SideBarElement(props: SideBarProps): ReactElement
{
	const currentView: string = props.cvController[0];
	const setCurrentView: (value: string) => void = props.cvController[1];

	const messageDatas: CoreType.MessageData[] = props.clientDataStateResult.psController[0].predictedDBData.dynamicPlayerData.messageDatas;
	const unreadMessageCount: number = MessageData.computeUnreadMessageCount(messageDatas);
	const unreadBadge: ReactElement | null = unreadMessageCount > 0
	    ?
	    (
	        <span className="text-yellow-400 font-bold ml-1">({unreadMessageCount})</span>
	    )
	    : null;

	const messagesLabel: ReactNode =
	(
	    <>Messages{unreadBadge}</>
	);

	const navItems: NavItem[] = buildNavItems(props.clientDataStateResult, messagesLabel);

	const adminSection: ReactElement | null = props.cuController[0].user!.admin_level === 0
	    ?
	    (
	        <button
	            onClick={() => props.onRefreshServerData(props.clientDataStateResult)}
	            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded w-full mb-2"
	        >
	            Refresh Server Data
	        </button>
	    )
	    : null;

	const sideBarElement: ReactElement =
	(
	    <div className="w-[200px] bg-black/50 text-white pt-[300px] pb-8 px-4 flex flex-col items-center min-h-screen">
	        <div className="text-sm text-gray-300 mb-12">
				{/*This should always be true as we gated with is Loading!*/}
	            {props.cuController[0].user!.username}
	        </div>

	        <div className="flex flex-col gap-0 w-full">
	            {navItems.map((navItem: NavItem): ReactElement => renderNavItem(navItem, currentView, setCurrentView))}
	        </div>

	        <div className="flex-1" />

	        {adminSection}

	        <button
	            onClick={() => props.onLogout(props.router)}
	            className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded w-full"
	        >
	            Log out
	        </button>
	    </div>
	);

	return sideBarElement;
}

function getSelectedPlanetBuildingLevel(clientDataStateResult: UseClientDataState.ClientDataStateResult, buildingType: GameType.BuildingType): number
{
	try
	{
		const selectedPlanetData: CoreType.PlanetData = SelectedPlanet.getSelectedPlanetDataPredicted(clientDataStateResult.psController[0]);
		return BuildingData.getBuildingLevel(selectedPlanetData, buildingType);
	}
	catch (error: unknown)
	{
		return 0;
	}
}

function getSelectedPlanetCategoryUnitQuantity(clientDataStateResult: UseClientDataState.ClientDataStateResult, unitCategory: GameType.UnitCategory): number
{
	try
	{
		const selectedPlanetData: CoreType.PlanetData = SelectedPlanet.getSelectedPlanetDataPredicted(clientDataStateResult.psController[0]);
		return UnitData.getCategoryUnitQuantity(selectedPlanetData, unitCategory);
	}
	catch (error: unknown)
	{
		return 0;
	}
}

function renderNavItem(navItem: NavItem, currentView: string, setCurrentView: (value: string) => void): ReactElement
{
	const hasSubItems: boolean = navItem.subItems.length > 0;
	const targetView: string = hasSubItems === true ? navItem.subItems[0].view : navItem.view;
	const isGroupExpanded: boolean = hasSubItems === true && navItem.subItems.some((subItem: NavItem): boolean => subItem.view === currentView);
	const isActive: boolean = hasSubItems === false && navItem.view === currentView;

	const parentButton: ReactElement = renderNavButton(navItem.label, targetView, isActive, false, setCurrentView);

	const subButtons: ReactElement[] = isGroupExpanded === true
	    ? navItem.subItems.map((subItem: NavItem): ReactElement => renderNavButton(subItem.label, subItem.view, subItem.view === currentView, true, setCurrentView))
	    : [];

	const element: ReactElement =
	(
	    <div key={navItem.view} className="flex flex-col gap-0 w-full">
	        {parentButton}
	        {subButtons}
	    </div>
	);

	return element;
}

function renderNavButton(label: ReactNode, view: string, isActive: boolean, isSubItem: boolean, setCurrentView: (value: string) => void): ReactElement
{
	const baseClass: string = "py-1 hover:bg-white/10 rounded transition-colors";
	const sizeClass: string = isSubItem === true ? "px-4 ml-6 text-left text-sm text-gray-300" : "px-4 text-left";
	const activeClass: string = isActive === true ? "bg-white/10 font-semibold" : "";
	const navButtonClass: string = `${baseClass} ${sizeClass} ${activeClass}`;

	const navButton: ReactElement =
	(
	    <button key={view} onClick={() => setCurrentView(view)} className={navButtonClass}>
	        {label}
	    </button>
	);

	return navButton;
}
