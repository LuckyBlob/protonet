"use client";

import * as UseLoadClientDataState from "@/lib/use/useLoadClientDataState";

type GameViewProps =
{
	clientDataStateResult: UseLoadClientDataState.ClientDataStateResult;
};

export function GameView(props: GameViewProps): React.ReactElement
{
	const gameViewElement: React.ReactElement =
	(
		<div>
			Future cool image.
		</div>
	);

	return gameViewElement;
}