"use client";

import { useEffect, useRef, useState } from "react";

import * as UseClientDataState from "@/lib/use/useClientDataState";
import * as ClientProgress from "@/lib/gameplay/progressUpdate/client/clientProgress";

const tickIntervalMilliseconds: number = 1000;

export function useAnimationTimer(clientDataStateResult: UseClientDataState.ClientDataStateResult): void
{
	const tickCounterState: [number, (value: number | ((prev: number) => number)) => void] = useState<number>(0);
	const setTickCounter: (value: number | ((prev: number) => number)) => void = tickCounterState[1];

	const stateRef = useRef(clientDataStateResult);
	useEffect(() => { stateRef.current = clientDataStateResult; });

	useEffect(() =>
	{
		if (clientDataStateResult.lsController[0].isLoading)
		{
			return;
		}

		const intervalId: NodeJS.Timeout = setInterval(() =>
		{
			setTickCounter((prev: number): number =>
			{
				return prev + 1;
			});
			ClientProgress.runClientTick(stateRef.current);
		}, tickIntervalMilliseconds);

		const cleanup: () => void = (): void =>
		{
			clearInterval(intervalId);
		};

		return cleanup;
	}, [clientDataStateResult.lsController[0].isLoading]);
}