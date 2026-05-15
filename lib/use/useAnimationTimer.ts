"use client";

import { useEffect, useState, useRef } from "react";
import * as ClientUpdate from "@/lib/update/client/clientUpdate";
import * as UseLoadClientDataState from "@/lib/use/useLoadClientDataState";

const tickIntervalMilliseconds: number = 1000;

export function useAnimationTimer(clientDataStateResult: UseLoadClientDataState.ClientDataStateResult): void
{
	const tickCounterState: [number, (value: number | ((prev: number) => number)) => void] = useState<number>(0);
	const setTickCounter: (value: number | ((prev: number) => number)) => void = tickCounterState[1];

	const stateRef = useRef(clientDataStateResult);
	useEffect(() => { stateRef.current = clientDataStateResult; });

	useEffect(() =>
	{
		console.log("isLoading:", clientDataStateResult.lsController[0].isLoading);
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
console.log("tick");
			ClientUpdate.runClientTick(stateRef.current);
		}, tickIntervalMilliseconds);

		const cleanup: () => void = (): void =>
		{
			clearInterval(intervalId);
		};

		return cleanup;
	}, [clientDataStateResult.lsController[0].isLoading]);
}