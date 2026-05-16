"use client";

import { useRouter } from "next/navigation";

import * as GameLayoutElement from "@/components/layout/gameLayoutElement";
import * as MainWindowElement from "@/components/layout/mainWindowElement";
import * as PlanetSelector from "@/components/widgets/planetSelector";
import * as SideBarElement from "@/components/layout/sideBarElement";
import * as TopBarElement from "@/components/layout/topBarElement";

import * as UseCurrentView from "@/lib/use/useCurrentView";
import * as UseClientDataState from "@/lib/use/useClientDataState";
import * as UseCurrentUser from "@/lib/use/useCurrentUser";

import * as Actions from "@/lib/mainPageHelpers/actions"

type MainPageContentProps =
{
	cuController: UseCurrentUser.CUController;
	cvController: UseCurrentView.CVController;
	clientDataStateResult: UseClientDataState.ClientDataStateResult;
};

export function MainPageContent(props: MainPageContentProps): React.ReactElement
{
	const router: ReturnType<typeof useRouter> = useRouter();

	const mainPageContent: React.ReactElement =
	(
		<GameLayoutElement.GameLayoutElement
            sideBar={
                <SideBarElement.SideBarElement
                    cuController={props.cuController}
                    cvController={props.cvController}
                    clientDataStateResult={props.clientDataStateResult}
                    router={router}
                    onLogout={Actions.handleLogout}
                    onRefreshServerData={Actions.handleRefreshServerData}
                />
            }
            topBar={
                <TopBarElement.TopBarElement
                    clientDataStateResult={props.clientDataStateResult}
                    planetSelector={
                        <PlanetSelector.PlanetSelector clientDataStateResult={props.clientDataStateResult}/>
                    }
                />
            }
            mainWindow={
                <MainWindowElement.MainWindowElement
                    cvController={props.cvController}
                    clientDataStateResult={props.clientDataStateResult}
                />
            }
        />
	);

	return mainPageContent;
}