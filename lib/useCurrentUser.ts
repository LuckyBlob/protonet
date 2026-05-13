"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { UserRow } from "./dbTypes";

export type UseCurrentUserResult =
{
	user: UserRow | null;
	isLoading: boolean;
};

export function useCurrentUser(): UseCurrentUserResult
{
	const router = useRouter();

	const userState: [UserRow | null, (value: UserRow | null) => void] = useState<UserRow | null>(null);
	const setUser: (value: UserRow | null) => void = userState[1];

	const isLoadingState: [boolean, (value: boolean) => void] = useState<boolean>(true);
	const setIsLoading: (value: boolean) => void = isLoadingState[1];

	useEffect(() =>
	{
		const fetchCurrentUser: () => Promise<void> = async () =>
		{
			const response: Response = await fetch("/api/me");
			const data: { user: UserRow | null } = await response.json();

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