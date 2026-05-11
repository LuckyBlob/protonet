"use client";

import * as MainPageTypes from "@/lib/mainPageTypes";

type GameViewProps =
{
	psController: MainPageTypes.PSController;
};

export function GameView(props: GameViewProps): React.ReactElement
{
	const gameViewElement: React.ReactElement =
	(
		<div>
			Game view (gold: {Math.floor(props.psController[0].currentPredictedValues.gold)})
		</div>
	);

	return gameViewElement;
}