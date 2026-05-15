"use client";

import { useRouter } from "next/navigation";
import { GameLayoutElement} from "@/components/mainPageElements/gameLayoutElement";
import { SideBarElement} from "@/components/mainPageElements/sideBarElement";
import { TopBarElement} from "@/components/mainPageElements/topBarElement";
import { MainWindowElement} from "@/components/mainPageElements/mainWindowElement";
import { LoadingElement } from "@/components/mainPageElements/loadingElement";
import * as AuthClient from "@/lib/authentication/authClient";
import * as PlayerUpdateClient from "@/lib/update/client/playerUpdateClient";
import * as SelectedPlanetDisplay from "@/lib/update/client/selectedPlanetDisplay";
import { PlanetSelector } from "@/components/mainPageElements/planetSelector";

import * as UseLoadCurrentUser from "@/lib/use/useLoadCurrentUser";
import * as UseLoadClientDataState from "@/lib/use/useLoadClientDataState";
import * as UseAnimationTimer from "@/lib/use/useAnimationTimer";
import * as UseCurrentView from "@/lib/use/useCurrentView"
import * as UseSelectedPlanetApplyUpdate from "@/lib/use/useSelectedPlanetApplyUpdate"
import * as MainPageType from "@/lib/mainPageTypes";

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
		return <LoadingElement />;
	}
	const displayValues: SelectedPlanetDisplay.SelectedPlanetDisplayValues = SelectedPlanetDisplay.getSelectedPlanetDisplayValues(clientDataStateResult);

	const pageComponent: React.ReactElement =
	(
		<GameLayoutElement
			sideBar={
				<SideBarElement
					cuController={cuController}
					cvController={cvController}
					clientDataStateResult={clientDataStateResult}
					router={router}
					onLogout={handleLogout}
					onRefreshServerData={handleRefreshServerData}
				/>
			}
			topBar={
				<TopBarElement
					clientDataStateResult={clientDataStateResult}
					planetSelector={
						<PlanetSelector clientDataStateResult={clientDataStateResult}/>
					}
				/>
			}
			mainWindow={
				<MainWindowElement
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

