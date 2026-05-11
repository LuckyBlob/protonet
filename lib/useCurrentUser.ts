"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export type CurrentUser =
{
	username: string;
};

export type UseCurrentUserResult =
{
	user: CurrentUser | null;
	isLoading: boolean;
};

export function useCurrentUser(): UseCurrentUserResult
{
	const router = useRouter();

	const userState: [CurrentUser | null, (value: CurrentUser | null) => void] = useState<CurrentUser | null>(null);
	const setUser: (value: CurrentUser | null) => void = userState[1];

	const isLoadingState: [boolean, (value: boolean) => void] = useState<boolean>(true);
	const setIsLoading: (value: boolean) => void = isLoadingState[1];

	useEffect(() =>
	{
		const fetchCurrentUser: () => Promise<void> = async () =>
		{
			const response: Response = await fetch("/api/me");
			const data: { user: CurrentUser | null } = await response.json();

			if (data.user === null)
			{
				router.push("/login");
				return;
			}

			setUser(data.user);
			setIsLoading(false);
		};

		fetchCurrentUser();
	}, []);

	const result: UseCurrentUserResult =
	{
		user: userState[0],
		isLoading: isLoadingState[0],
	};

	return result;
}