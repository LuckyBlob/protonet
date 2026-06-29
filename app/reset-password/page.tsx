"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ReactElement } from "react";

import * as ClientRequestFunctions from "@/lib/networkRequests/client/clientRequestFunctions";

export default function ResetPasswordPage()
{
	const router = useRouter();

	const tokenState: [string, (value: string) => void] = useState<string>("");
	const setToken: (value: string) => void = tokenState[1];

	const passwordState: [string, (value: string) => void] = useState<string>("");
	const setPassword: (value: string) => void = passwordState[1];

	const errorState: [string | null, (value: string | null) => void] = useState<string | null>(null);
	const setError: (value: string | null) => void = errorState[1];

	const doneState: [boolean, (value: boolean) => void] = useState<boolean>(false);
	const setDone: (value: boolean) => void = doneState[1];

	useEffect(() =>
	{
		const tokenFromUrl: string = new URLSearchParams(window.location.search).get("token") ?? "";
		setToken(tokenFromUrl);
	}, []);

	const handleSubmit: () => Promise<void> = async () =>
	{
		try
		{
			await ClientRequestFunctions.clientTryResetPasswordRequest(tokenState[0], passwordState[0]);
			setDone(true);
		}
		catch (error: unknown)
		{
			if (error instanceof Error)
			{
				setError(error.message);
			}
			else
			{
				setError("An unexpected error occurred");
			}
		}
	};

	const errorElement: ReactElement | null = errorState[0] !== null
		? <div className="text-red-500">{errorState[0]}</div>
		: null;

	if (doneState[0] === true)
	{
		const doneElement: ReactElement =
		(
			<main className="p-8 flex flex-col gap-4 max-w-md">
				<h1 className="text-2xl font-bold">Password updated</h1>
				<div className="text-green-500">Your password has been changed. You can now log in.</div>
				<button onClick={() => router.push("/login")} className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 self-start">
					Go to log in
				</button>
			</main>
		);

		return doneElement;
	}

	const pageElement: ReactElement =
	(
		<main className="p-8 flex flex-col gap-4 max-w-md">
			<h1 className="text-2xl font-bold">Choose a new password</h1>
			<input
				type="password"
				placeholder="New password (6+ chars)"
				value={passwordState[0]}
				onChange={(e) => setPassword(e.target.value)}
				className="border border-gray-400 px-2 py-1 rounded bg-white text-black placeholder:text-gray-400"
			/>
			{errorElement}
			<button
				onClick={handleSubmit}
				className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
			>
				Reset password
			</button>
			<a href="/login" className="text-blue-500 underline">
				Back to log in
			</a>
		</main>
	);

	return pageElement;
}
