"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import * as DBType from "@/lib/db/dbTypes";
import * as ServerRequest from "@/lib/serverRequests/serverRequests";
import * as RequestType from "@/lib/serverRequests/requestTypes";
import { DataRequest } from "@/app/api/apiEndPoints"

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
			const userRowRequest: RequestType.UserRowRequest | null = await ServerRequest.requestServerData(DataRequest.UserInfo);
			
			if (userRowRequest === null || userRowRequest.userRow == null)
			{
				router.push("/login");
				return;
			}

			const currentUserResult: CurrentUserResult =
			{
				user: userRowRequest.userRow,
				isLoading: false
			}

			cuController[1](currentUserResult);
		};

		currentUser();
	}, []);

	return cuController;
}