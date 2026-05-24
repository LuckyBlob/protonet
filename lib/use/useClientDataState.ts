"use client";

import { useEffect, useState } from "react";

import * as PlayerDataType from "@/lib/gameplay/gameplayData/player/playerDataTypes";
import * as ServerDataType from "@/lib/gameplay/gameplayData/server/serverDataTypes";
import * as ClientRequestFunctions from "@/lib/networkRequests/client/clientRequestFunctions";

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
			try
			{
				await ClientRequestFunctions.clientTryPlayerDataRequest(psController);
				await ClientRequestFunctions.clientTryServerConfigRequest(sdsController);
				lsController[1]({ isLoading: false });
			}
			catch (error: unknown)
			{
				console.error("⚠️:", error);
				lsController[1]({ isLoading: true });
			}
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
