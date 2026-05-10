 "use client";

import { PlayerRow } from "@/lib/dbTypes";
import { useEffect, useState } from "react";

import * as BaseComponents from "@/components/baseComponents";
import * as PlayerUpdateClient from "@/lib/playerUpdateClient";
import * as MainPageTypes from "@/lib/mainPageTypes";
import * as ClientUpdate from "@/lib/clientUpdate";

export default function Home()
{
	const psController: MainPageTypes.PSController = useState<MainPageTypes.PlayerState>(MainPageTypes.NullPlayerState);

	const isLoadingState: [boolean, (value: boolean) => void] = useState<boolean>(true);
	const setIsLoading: (value: boolean) => void = isLoadingState[1];

	useEffect(() =>
	{
		PlayerUpdateClient.fetchAndSetPlayerState(psController, 1).then(() =>
    {
      setIsLoading(false);
    });
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

	const showGoldComponent: React.ReactElement =
	(
		<div>
			Gold: {Math.floor(psController[0].currentPredictedValues.gold)}<br />
			Gold per second: {Math.floor(psController[0].dbData.production_rate)}
		</div>
	);

	const incrementGoldProductionButton: React.ReactElement =
	(
		<
			button
			onClick={() => PlayerUpdateClient.incrementPlayerGoldProduction(psController)}
			className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
		>
			Increment gold production by 1 per second!
		</button>
	);

	const pageComponent: React.ReactElement =
	(
		<main>
			{showGoldComponent}
			{incrementGoldProductionButton}
		</main>
	);

	return pageComponent;
}
