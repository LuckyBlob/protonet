"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
	GameLayoutElement,
	SideBarElement,
	TopBarElement,
	MainWindowElement,
} from "@/components/persistentComponents";
import * as BaseComponents from "@/components/baseComponents";
import * as UpgradeCost from "@/lib/upgradeCost";
import * as AuthClient from "@/lib/authClient";
import * as PlayerUpdateClient from "@/lib/playerUpdateClient";

import { useCurrentUser } from "@/lib/useCurrentUser";
import { useClientDataLoad } from "@/lib/useClientDataLoad";

export default function Home()
{
	const router = useRouter();
	const useCurrentUserResult = useCurrentUser();
	const useClientDataResult = useClientDataLoad(useCurrentUserResult.user !== null);

	const currentViewState: [string, (value: string) => void] = useState<string>("game");
	const setCurrentView: (value: string) => void = currentViewState[1];

	if (useCurrentUserResult.isLoading === true || useClientDataResult.isLoading === true)
	{
		return <BaseComponents.LoadingElement />;
	}

	if (useCurrentUserResult.user === null)
	{
		return <BaseComponents.LoadingElement />;
	}

	const handleLogout: () => Promise<void> = async () =>
	{
		await AuthClient.tryLogout();
		router.push("/login");
	};

	const handleRefreshServerData: () => Promise<void> = async () =>
	{
		await PlayerUpdateClient.tryRefreshServerData
		(
			useClientDataResult.psController,
			useClientDataResult.sdsController,
		);
	};

	const pageComponent: React.ReactElement =
	(
		<GameLayoutElement
			sideBar={
				<SideBarElement
					username={useCurrentUserResult.user.username}
					currentView={currentViewState[0]}
					admin_level={useCurrentUserResult.user.admin_level}
					onSelectView={setCurrentView}
					onLogout={handleLogout}
					onRefreshServerData={handleRefreshServerData}
				/>
			}
			topBar={
				<TopBarElement
					gold={Math.floor(useClientDataResult.psController[0].predictedDBData.gold)}
					productionRate={Math.floor(UpgradeCost.getProductionRate(useClientDataResult.psController[0].predictedDBData, useClientDataResult.sdsController[0]) * 3600)}
					buildCompletesAt={useClientDataResult.psController[0].predictedDBData.building_upgrade_completes_at}
				/>
			}
			mainWindow={
				<MainWindowElement
					currentView={currentViewState[0]}
					psController={useClientDataResult.psController}
					sdsController={useClientDataResult.sdsController}
				/>
			}
		/>
	);

	return pageComponent;
}