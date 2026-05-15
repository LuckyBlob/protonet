"use client";

import { useEffect, useState } from "react";

import * as MainPageType from "@/lib/mainPageTypes";

import * as PlayerDataType from "@/lib/playerData/playerDataTypes";

import * as ServerDataType from "@/lib/serverData/serverDataTypes";

import * as PlayerUpdateClient from "@/lib/update/client/playerUpdateClient";

export type ClientDataStateResult =
{
	psController: MainPageType.PSController;
	sdsController: MainPageType.SDSController;
	lsController: MainPageType.LSController;
};

export function useLoadClientDataState(enabled: boolean): ClientDataStateResult
{
	const psController: MainPageType.PSController = useState<PlayerDataType.PlayerState>({} as PlayerDataType.PlayerState);
	const sdsController: MainPageType.SDSController = useState<ServerDataType.ServerData>({} as ServerDataType.ServerData);
	const lsController: MainPageType.LSController = useState<PlayerDataType.LoadingState>({ isLoading: true } as PlayerDataType.LoadingState);

	useEffect(() =>
	{
		if (enabled === false)
		{
			return;
		}

		const loadClientDataState: () => Promise<void> = async (): Promise<void> =>
		{
			await PlayerUpdateClient.fetchAndSetPlayerState(psController);
			await PlayerUpdateClient.fetchAndSetServerData(sdsController);
			lsController[1]({ isLoading: false });
		};

		loadClientDataState();
	}, [enabled]);

	const result: ClientDataStateResult =
	{
		psController: psController,
		sdsController: sdsController,
		lsController: lsController,
	};

	return result;
}