import { useRouter } from "next/navigation";
import React from "react";

import * as UseClientDataState from "@/lib/use/useClientDataState";
import * as UseCurrentView from "@/lib/use/useCurrentView";
import * as UseCurrentUser from "@/lib/use/useCurrentUser";

type SideBarProps =
{
	cuController: UseCurrentUser.CUController;
	cvController: UseCurrentView.CVController;
	clientDataStateResult: UseClientDataState.ClientDataStateResult;
	router: ReturnType<typeof useRouter>;
	onLogout: (router: ReturnType<typeof useRouter>) => void;
	onRefreshServerData: (clientDataStateResult: UseClientDataState.ClientDataStateResult) => void;
};

export function SideBarElement(props: SideBarProps): React.ReactElement
{
	const navButtonClass: string = "px-4 py-1 text-center hover:bg-white/10 rounded transition-colors";

	const adminSection: React.ReactElement | null = props.cuController[0].user!.admin_level === 0
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

	const sideBarElement: React.ReactElement =
	(
	    <div className="w-[200px] bg-black/50 text-white pt-[300px] pb-8 px-4 flex flex-col items-center min-h-screen">
	        <div className="text-sm text-gray-300 mb-12">
				{/*This should always be true as we gated with is Loading!*/}
	            {props.cuController[0].user!.username}
	        </div>

	        <div className="flex flex-col gap-0 w-full">
	            <button onClick={() => props.cvController[1]("game")} className={navButtonClass}>Game</button>
	            <button onClick={() => props.cvController[1]("upgrades")} className={navButtonClass}>Upgrades</button>
	            <button onClick={() => props.cvController[1]("shipyard")} className={navButtonClass}>Shipyard</button>
	            <button onClick={() => props.cvController[1]("ships")} className={navButtonClass}>Ships</button>
	            <button onClick={() => props.cvController[1]("stats")} className={navButtonClass}>Stats</button>
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