"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ReactElement } from "react";

import * as ClientRequestFunctions from "@/lib/networkRequests/client/clientRequestFunctions";

const VerifyStatus =
{
	Pending: 1,
	Success: 2,
	Failure: 3,
} as const;
type VerifyStatus = typeof VerifyStatus[keyof typeof VerifyStatus];

export default function VerifyPage()
{
	const router = useRouter();

	const statusState: [VerifyStatus, (value: VerifyStatus) => void] = useState<VerifyStatus>(VerifyStatus.Pending);
	const setStatus: (value: VerifyStatus) => void = statusState[1];

	const errorState: [string | null, (value: string | null) => void] = useState<string | null>(null);
	const setError: (value: string | null) => void = errorState[1];

	useEffect(() =>
	{
		const verify: () => Promise<void> = async () =>
		{
			const tokenFromUrl: string = new URLSearchParams(window.location.search).get("token") ?? "";

			try
			{
				await ClientRequestFunctions.clientTryVerifyEmailRequest(tokenFromUrl);
				setStatus(VerifyStatus.Success);
				router.push("/");
			}
			catch (error: unknown)
			{
				setError(error instanceof Error ? error.message : "An unexpected error occurred");
				setStatus(VerifyStatus.Failure);
			}
		};

		verify();
	}, []);

	if (statusState[0] === VerifyStatus.Pending)
	{
		return <main className="p-8 flex flex-col gap-4 max-w-md"><h1 className="text-2xl font-bold">Verifying your account…</h1></main>;
	}

	if (statusState[0] === VerifyStatus.Success)
	{
		return <main className="p-8 flex flex-col gap-4 max-w-md"><h1 className="text-2xl font-bold">Account verified! Taking you to the game…</h1></main>;
	}

	const failureElement: ReactElement =
	(
		<main className="p-8 flex flex-col gap-4 max-w-md">
			<h1 className="text-2xl font-bold">Verification failed</h1>
			<div className="text-red-500">{errorState[0]}</div>
			<a href="/login" className="text-blue-500 underline">
				Back to log in
			</a>
		</main>
	);

	return failureElement;
}
