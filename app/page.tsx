 "use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import * as BaseComponents from "@/components/baseComponents";
import * as PlayerUpdateClient from "@/lib/playerUpdateClient";
import * as MainPageTypes from "@/lib/mainPageTypes";
import * as ClientUpdate from "@/lib/clientUpdate";
import * as UpgradeCost from "@/lib/upgradeCost";
import * as AuthClient from "@/lib/authClient";

export default function Home()
{
  const router = useRouter();

	const psController: MainPageTypes.PSController = useState<MainPageTypes.PlayerState>(MainPageTypes.NullPlayerState);

	const isLoadingState: [boolean, (value: boolean) => void] = useState<boolean>(true);
	const setIsLoading: (value: boolean) => void = isLoadingState[1];

	const usernameState: [string | null, (value: string | null) => void] = useState<string | null>(null);
	const setUsername: (value: string | null) => void = usernameState[1];

	useEffect(() =>
	{
		const initialize: () => Promise<void> = async () =>
		{
			const meResponse: Response = await fetch("/api/me");
			const meData: { user: { username: string } | null } = await meResponse.json();

			if (meData.user === null)
			{
				router.push("/login");
				return;
			}

			setUsername(meData.user.username);
			await PlayerUpdateClient.fetchAndSetPlayerState(psController, 1);
			setIsLoading(false);
		};

		initialize();
	}, []);

  useEffect(() =>
  {
    const cleanup: () => void = ClientUpdate.addAnimationTimer(psController);
    return cleanup;
  }, [psController[0].dbData]);
  
	if (isLoadingState[0] === true)
	{
		return <BaseComponents.LoadingElement />;
	}
  
  const handleLogout: () => Promise<void> = async () =>
	{
		await AuthClient.tryLogout();
		router.push("/login");
	};

	const userHeader: React.ReactElement =
	(
		<div className="flex justify-between items-center mb-4">
			<div>
        Logged in as: {usernameState[0]}
      </div>
			<button onClick={handleLogout} className="px-3 py-1 bg-gray-500 text-white rounded hover:bg-gray-600 text-sm">
				Log out
			</button>
		</div>
	);

	const showGoldComponent: React.ReactElement =
	(
		<div>
			Gold: {Math.floor(psController[0].currentPredictedValues.gold)}<br />
			Gold per second: {Math.floor(psController[0].dbData.production_rate)}<br />
			Upgrade level: {psController[0].dbData.upgrade_level}
		</div>
	);

	const buyUpgradeButton: React.ReactElement =
	(
		<button
			onClick={() => PlayerUpdateClient.tryBuyUpgrade(psController)}
      disabled={UpgradeCost.canAffordUpgrade(psController) === false}
			className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
		>
			Buy Upgrade! (Cost: {UpgradeCost.computeUpgradeCost(psController[0].dbData.upgrade_level)})
		</button>
	);

	const pageComponent: React.ReactElement =
	(
		<main className="p-8">
			{userHeader}
			{showGoldComponent}
			{buyUpgradeButton}
		</main>
	);

	return pageComponent;
}
