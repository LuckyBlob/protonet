"use client";

import { ReactElement } from "react";

import * as UseClientDataState from "@/lib/use/useClientDataState";

type GameViewProps =
{
	clientDataStateResult: UseClientDataState.ClientDataStateResult;
};

export function GameView(props: GameViewProps): ReactElement
{
	const gameViewElement: ReactElement =
	(
		<div>
			Future cool image.
		</div>
	);

	return gameViewElement;
}