"use client";

import { useEffect, useState } from "react";

import * as PlayerDataType from "@/lib/playerData/playerDataTypes";

import * as ServerDataType from "@/lib/serverData/serverDataTypes";

import * as PlayerUpdateClient from "@/lib/update/client/playerUpdateClient";

export type ClientDataStateResult =
{
	psController: PlayerDataType.PSController;
	sdsController: ServerDataType.SDSController;
	lsController: PlayerDataType.LSController;
};

export function useClientDataState(enabled: boolean): ClientDataStateResult
{
	const psController: PlayerDataType.PSController = useState<PlayerDataType.PlayerState>({} as PlayerDataType.PlayerState);
	const sdsController: ServerDataType.SDSController = useState<ServerDataType.ServerData>({} as ServerDataType.ServerData);
	const lsController: PlayerDataType.LSController = useState<PlayerDataType.LoadingState>({ isLoading: true } as PlayerDataType.LoadingState);

	useEffect(() =>
	{
		if (enabled === false)
		{
			return;
		}

		const clientDataState: () => Promise<void> = async (): Promise<void> =>
		{
			await PlayerUpdateClient.fetchAndSetPlayerState(psController);
			await PlayerUpdateClient.fetchAndSetServerData(sdsController);
			lsController[1]({ isLoading: false });
		};

		clientDataState();
	}, [enabled]);

	const result: ClientDataStateResult =
	{
		psController: psController,
		sdsController: sdsController,
		lsController: lsController,
	};

	return result;
}