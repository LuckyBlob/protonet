import { useRouter } from "next/navigation";
import { ReactElement, ReactNode } from "react";

import * as UseClientDataState from "@/lib/use/useClientDataState";
import * as UseCurrentView from "@/lib/use/useCurrentView";
import * as UseCurrentUser from "@/lib/use/useCurrentUser";
import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as MessageData from "@/lib/gameplay/dynamicData/player/messageData";

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

	const navItems: NavItem[] =
	[
	    { view: "game", label: "Game", subItems: [] },
	    { view: "buildings", label: "Buildings", subItems: [] },
	    { view: "research", label: "Research", subItems: [] },
	    { view: "shipyard", label: "Shipyard", subItems: [] },
	    { view: "fleets", label: "Fleets", subItems: [] },
	    {
	        view: "planets",
	        label: "Planets",
	        subItems:
	        [
	            { view: "planets", label: "Galaxy", subItems: [] },
	            { view: "currentPlanet", label: "Current Planet", subItems: [] },
	        ],
	    },
	    { view: "messages", label: messagesLabel, subItems: [] },
	    { view: "stats", label: "Stats", subItems: [] },
	    { view: "account", label: "Account", subItems: [] },
	];

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
