"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import * as MainPageType from "@/lib/mainPageTypes";

import * as DBType from "@/lib/db/dbTypes";

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

export function useLoadCurrentUser(): MainPageType.CUController
{
	const router = useRouter();

	const cuController: MainPageType.CUController = useState<CurrentUserResult>(UnloadedCurrentUserResult);

	useEffect(() =>
	{
		const loadCurrentUser: () => Promise<void> = async () =>
		{
			const response: Response = await fetch("/api/me");
			const data: { user: DBType.UserRow | null } = await response.json();

			if (data.user === null)
			{
				router.push("/login");
				return;
			}

			const currentUserResult: CurrentUserResult =
			{
				user: data.user,
				isLoading: false
			}

			cuController[1](currentUserResult);
		};

		loadCurrentUser();
	}, []);

	return cuController;
}