"use client";

import { useEffect, useState } from "react";
import * as PlayerUpdateClient from "@/lib/playerUpdateClient";
import * as ClientUpdate from "@/lib/clientUpdate";
import * as MainPageTypes from "@/lib/mainPageTypes";
import * as ServerDataTypes from "@/lib/serverDataTypes";

export type UseClientDataStateResult =
{
	psController: MainPageTypes.PSController;
	sdsController: MainPageTypes.SDSController;
	isLoading: boolean;
};

export function useClientDataLoad(enabled: boolean): UseClientDataStateResult
{
	const psController: MainPageTypes.PSController = useState<MainPageTypes.PlayerState>(MainPageTypes.NullPlayerState);
	const sdsController: MainPageTypes.SDSController = useState<ServerDataTypes.ServerData>(ServerDataTypes.DefaultServerData);

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
			await PlayerUpdateClient.fetchAndSetServerData(sdsController);
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

		const cleanup: () => void = ClientUpdate.addAnimationTimer(psController, sdsController);
		return cleanup;
	}, [psController[0].dbData, sdsController[0], isLoadingState[0]]);

	const result: UseClientDataStateResult =
	{
		psController: psController,
		sdsController: sdsController,
		isLoading: isLoadingState[0],
	};

	return result;
}