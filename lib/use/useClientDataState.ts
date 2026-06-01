"use client";

import { useEffect, useState } from "react";

import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as ClientRequestFunctions from "@/lib/networkRequests/client/clientRequestFunctions";

export type ClientDataStateResult =
{
	psController: CoreType.PSController;
	sdsController: CoreType.SDSController;
	lsController: CoreType.LSController;
};

export function useClientDataState(enabled: boolean): ClientDataStateResult
{
	const psController: CoreType.PSController = useState<CoreType.PlayerState>({} as CoreType.PlayerState);
	const sdsController: CoreType.SDSController = useState<CoreType.ServerData>({} as CoreType.ServerData);
	const lsController: CoreType.LSController = useState<CoreType.LoadingState>({ isLoading: true } as CoreType.LoadingState);

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
				console.error("⚠️:", "useClientDataState initial fetch failed:", error);
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
