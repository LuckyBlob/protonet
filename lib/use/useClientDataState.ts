"use client";

import { useEffect, useState } from "react";

import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as ClientRequestFunctions from "@/lib/networkRequests/client/clientRequestFunctions";
import * as ErrorHelp from "@/lib/helper/errorHelp";

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
	const lsController: CoreType.LSController = useState<CoreType.LoadingState>({ isLoading: true, error: null });

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
				lsController[1]({ isLoading: false, error: null });
			}
			catch (error: unknown)
			{
				console.error("⚠️:", error);
				const errorMessage: string = ErrorHelp.getErrorMessage(error);
				lsController[1]({ isLoading: true, error: errorMessage });
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
