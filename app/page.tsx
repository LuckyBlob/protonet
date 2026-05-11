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
import { useCurrentUser } from "@/lib/useCurrentUser";
import { usePlayerStateLoad } from "@/lib/usePlayerStateLoad";

export default function Home()
{
	const router = useRouter();
	const currentUser = useCurrentUser();
	const playerState = usePlayerStateLoad(currentUser.user !== null);

	const currentViewState: [string, (value: string) => void] = useState<string>("game");
	const setCurrentView: (value: string) => void = currentViewState[1];

	if (currentUser.isLoading === true || playerState.isLoading === true)
	{
		return <BaseComponents.LoadingElement />;
	}

	if (currentUser.user === null)
	{
		return <BaseComponents.LoadingElement />;
	}

	const handleLogout: () => Promise<void> = async () =>
	{
		await AuthClient.tryLogout();
		router.push("/login");
	};

	const pageComponent: React.ReactElement =
	(
		<GameLayoutElement
			sideBar={
				<SideBarElement
					username={currentUser.user.username}
					currentView={currentViewState[0]}
					onSelectView={setCurrentView}
					onLogout={handleLogout}
				/>
			}
			topBar={
				<TopBarElement
					gold={Math.floor(playerState.psController[0].currentPredictedValues.gold)}
					productionRate={Math.floor(UpgradeCost.getProductionRate(playerState.psController[0].dbData) * 3600)}
					buildCompletesAt={playerState.psController[0].dbData.building_upgrade_completes_at}
				/>
			}
			mainWindow={
				<MainWindowElement
					currentView={currentViewState[0]}
					psController={playerState.psController}
				/>
			}
		/>
	);

	return pageComponent;
}