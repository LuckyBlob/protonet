 "use client";

import { PlayerRow } from "@/lib/dbTypes";
import { useEffect, useState } from "react";

import * as BaseComponents from "@/components/baseComponents";
import * as PlayerUpdateClient from "@/lib/playerUpdateClient";

export default function Home()
{
	const NullPlayerState: PlayerRow =
	{
		id: 0,
		gold: 0,
		production_rate: 0,
		last_updated: 0
	};
	const playerState: [PlayerRow, (value: PlayerRow) => void] = useState<PlayerRow>(NullPlayerState);
	const setPlayerState: (value: PlayerRow) => void = playerState[1];

	const isLoadingState: [boolean, (value: boolean) => void] = useState<boolean>(true);
	const setIsLoading: (value: boolean) => void = isLoadingState[1];

	useEffect(() =>
	{
		PlayerUpdateClient.fetchAndSetPlayerState(setPlayerState, setIsLoading, 1);
	}, []);

	if (isLoadingState[0] === true)
	{
		return <BaseComponents.LoadingElement />;
	}

	const showGoldComponent: React.ReactElement =
	(
		<div>
			Gold: {Math.floor(playerState[0].gold)}<br />
			Gold per second: {Math.floor(playerState[0].production_rate)}
		</div>
	);

	const incrementGoldProductionButton: React.ReactElement =
	(
		<
			button
			onClick={() => PlayerUpdateClient.incrementPlayerGoldProduction(setPlayerState)}
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
