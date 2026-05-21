"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import * as DBType from "@/lib/db/dbTypes";
import * as APIEndPoint from "@/app/api/apiEndPoints";
import * as ClientRequestFunctions from "@/lib/networkRequests/client/clientRequestFunctions";

export type CUController  = [CurrentUserResult, (value: CurrentUserResult) => void];
export type CurrentUserResult =
{
	user: DBType.UserRow | null;
	isLoading: boolean;
};

const UnloadedCurrentUserResult: CurrentUserResult =
{
	user: null,
	isLoading: true
};

export function useCurrentUser(): CUController
{
	const router = useRouter();

	const cuController: CUController = useState<CurrentUserResult>(UnloadedCurrentUserResult);

	useEffect(() =>
	{
		const currentUser: () => Promise<void> = async () =>
		{
			const response: APIEndPoint.ResponseForData<typeof APIEndPoint.DataRequest.UserInfo> | null = await ClientRequestFunctions.clientTryUserInfoRequest();

    		// Use != instead of !== here to catch everything that's very weird.
			if (response === null || response.userRow == null)
			{
				router.push("/login");
				return;
			}

			const currentUserResult: CurrentUserResult =
			{
				user: response.userRow,
				isLoading: false
			};

			cuController[1](currentUserResult);
		};

		currentUser();
	}, []);

	return cuController;
}
