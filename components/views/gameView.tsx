"use client";

import * as UseClientDataState from "@/lib/use/useClientDataState";

type GameViewProps =
{
	clientDataStateResult: UseClientDataState.ClientDataStateResult;
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