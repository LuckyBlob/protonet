import { useRouter } from "next/navigation";
import React from "react";

import * as MainPageType from "@/lib/mainPageTypes";
import * as UseLoadClientDataState from "@/lib/use/useLoadClientDataState";

type SideBarProps =
{
    cuController: MainPageType.CUController;
    cvController: MainPageType.CVController;
    clientDataStateResult: UseLoadClientDataState.ClientDataStateResult;
    router: ReturnType<typeof useRouter>;
    onLogout: (router: ReturnType<typeof useRouter>) => void;
    onRefreshServerData: (clientDataStateResult: UseLoadClientDataState.ClientDataStateResult) => void;
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
                {props.cuController[0].user!.username}
            </div>

            <div className="flex flex-col gap-0 w-full">
                <button onClick={() => props.cvController[1]("game")} className={navButtonClass}>Game</button>
                <button onClick={() => props.cvController[1]("upgrades")} className={navButtonClass}>Upgrades</button>
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