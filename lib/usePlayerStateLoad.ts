"use client";

import { useEffect, useState } from "react";
import * as PlayerUpdateClient from "@/lib/playerUpdateClient";
import * as ClientUpdate from "@/lib/clientUpdate";
import * as MainPageTypes from "@/lib/mainPageTypes";

export type UsePlayerStateResult =
{
	psController: MainPageTypes.PSController;
	isLoading: boolean;
};

export function usePlayerStateLoad(enabled: boolean): UsePlayerStateResult
{
	const psController: MainPageTypes.PSController = useState<MainPageTypes.PlayerState>(MainPageTypes.NullPlayerState);

	const isLoadingState: [boolean, (value: boolean) => void] = useState<boolean>(true);
	const setIsLoading: (value: boolean) => void = isLoadingState[1];

	useEffect(() =>
	{
		if (enabled === false)
		{
			return;
		}

		const loadInitial: () => Promise<void> = async () =>
		{
			await PlayerUpdateClient.fetchAndSetPlayerState(psController, 1);
			setIsLoading(false);
		};

		loadInitial();
	}, [enabled]);

	useEffect(() =>
	{
		if (isLoadingState[0] === true)
		{
			return;
		}

		const cleanup: () => void = ClientUpdate.addAnimationTimer(psController);
		return cleanup;
	}, [psController[0].dbData, isLoadingState[0]]);

	const result: UsePlayerStateResult =
	{
		psController: psController,
		isLoading: isLoadingState[0],
	};

	return result;
}