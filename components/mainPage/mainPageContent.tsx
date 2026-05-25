"use client";

import { useRouter } from "next/navigation";
import { ReactElement } from "react";

import * as GameLayoutElement from "@/components/layout/gameLayoutElement";
import * as MainWindowElement from "@/components/layout/mainWindowElement";
import * as PlanetSelector from "@/components/widgets/planetSelector";
import * as SideBarElement from "@/components/layout/sideBarElement";
import * as TopBarElement from "@/components/layout/topBarElement";
import * as ClientRequestFunctions from "@/lib/networkRequests/client/clientRequestFunctions";
import * as UseCurrentView from "@/lib/use/useCurrentView";
import * as UseClientDataState from "@/lib/use/useClientDataState";
import * as UseCurrentUser from "@/lib/use/useCurrentUser";
import * as APIEndPoint from "@/app/api/apiEndPoints";

type MainPageContentProps =
{
	cuController: UseCurrentUser.CUController;
	cvController: UseCurrentView.CVController;
	clientDataStateResult: UseClientDataState.ClientDataStateResult;
};

export function MainPageContent(props: MainPageContentProps): ReactElement
{
	const router: ReturnType<typeof useRouter> = useRouter();

	const mainPageContent: ReactElement =
	(
		<GameLayoutElement.GameLayoutElement
            sideBar={
                <SideBarElement.SideBarElement
                    cuController={props.cuController}
                    cvController={props.cvController}
                    clientDataStateResult={props.clientDataStateResult}
                    router={router}
                    onLogout={handleLogout}
                    onRefreshServerData={handleRefreshServerData}
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

export async function handleLogout(router: ReturnType<typeof useRouter>): Promise<void>
{
    const response: APIEndPoint.ResponseForAction<typeof APIEndPoint.ActionRequest.Logout> | null = await ClientRequestFunctions.clientTryLogoutRequest();
    if (response === null)
    {
        return;
    }
    router.push("/login");
};

export async function handleRefreshServerData(clientDataStateResult: UseClientDataState.ClientDataStateResult): Promise<void>
{
    await ClientRequestFunctions.clientTryRefreshServerRequest(clientDataStateResult);
};

export function shouldShowLoading(cuController: UseCurrentUser.CUController, clientDataStateResult: UseClientDataState.ClientDataStateResult): boolean
{
    if (cuController[0].isLoading || clientDataStateResult.lsController[0].isLoading)
    {
        return true;
    }

    if (cuController[0].user === null)
    {
        return true;
    }

    return false;
}
