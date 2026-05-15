"use client";

import { useRouter } from "next/navigation";

import * as MainPageType from "@/lib/mainPageTypes";

import * as GameLayoutElement from "@/components/mainPageElements/gameLayoutElement";
import * as LoadingElement from "@/components/mainPageElements/loadingElement";
import * as MainWindowElement from "@/components/mainPageElements/mainWindowElement";
import * as PlanetSelector from "@/components/mainPageElements/planetSelector";
import * as SideBarElement from "@/components/mainPageElements/sideBarElement";
import * as TopBarElement from "@/components/mainPageElements/topBarElement";

import * as AuthClient from "@/lib/authentication/authClient";

import * as UseAnimationTimer from "@/lib/use/useAnimationTimer";
import * as UseCurrentView from "@/lib/use/useCurrentView";
import * as UseLoadClientDataState from "@/lib/use/useLoadClientDataState";
import * as UseLoadCurrentUser from "@/lib/use/useLoadCurrentUser";
import * as UseSelectedPlanetApplyUpdate from "@/lib/use/useSelectedPlanetApplyUpdate";

import * as PlayerUpdateClient from "@/lib/update/client/playerUpdateClient";
import * as SelectedPlanetDisplay from "@/lib/update/client/selectedPlanetDisplay";

export default function Home()
{
	const router = useRouter();
	const cuController: MainPageType.CUController = UseLoadCurrentUser.useLoadCurrentUser();
	const clientDataStateResult: UseLoadClientDataState.ClientDataStateResult = UseLoadClientDataState.useLoadClientDataState(cuController[0].user !== null);
	const cvController: MainPageType.CVController = UseCurrentView.useCurrentView();

	UseAnimationTimer.useAnimationTimer(clientDataStateResult);
	UseSelectedPlanetApplyUpdate.useSelectedPlanetApplyUpdate(clientDataStateResult);

	if (shouldShowLoading(cuController, clientDataStateResult))
	{
		return <LoadingElement.LoadingElement />;
	}
	const displayValues: SelectedPlanetDisplay.SelectedPlanetDisplayValues = SelectedPlanetDisplay.getSelectedPlanetDisplayValues(clientDataStateResult);

	const pageComponent: React.ReactElement =
	(
		<GameLayoutElement.GameLayoutElement
			sideBar={
				<SideBarElement.SideBarElement
					cuController={cuController}
					cvController={cvController}
					clientDataStateResult={clientDataStateResult}
					router={router}
					onLogout={handleLogout}
					onRefreshServerData={handleRefreshServerData}
				/>
			}
			topBar={
				<TopBarElement.TopBarElement
					clientDataStateResult={clientDataStateResult}
					planetSelector={
						<PlanetSelector.PlanetSelector clientDataStateResult={clientDataStateResult}/>
					}
				/>
			}
			mainWindow={
				<MainWindowElement.MainWindowElement
					cvController={cvController}
					clientDataStateResult={clientDataStateResult}
				/>
			}
		/>
	);

	return pageComponent;
}

function shouldShowLoading(cuController: MainPageType.CUController, clientDataStateResult: UseLoadClientDataState.ClientDataStateResult)
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

async function handleLogout(router: ReturnType<typeof useRouter>): Promise<void>
{
	await AuthClient.tryLogout();
	router.push("/login");
};

async function handleRefreshServerData(clientDataStateResult: UseLoadClientDataState.ClientDataStateResult): Promise<void>
{
	await PlayerUpdateClient.tryRefreshServerData(clientDataStateResult);
};