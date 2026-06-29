"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ReactElement } from "react";

import * as ClientRequestFunctions from "@/lib/networkRequests/client/clientRequestFunctions";
import * as APIEndPoint from "@/app/api/apiEndPoints";

export default function LoginPage()
{
	const router = useRouter();

	const identifierState: [string, (value: string) => void] = useState<string>("");
	const setIdentifier: (value: string) => void = identifierState[1];

	const passwordState: [string, (value: string) => void] = useState<string>("");
	const setPassword: (value: string) => void = passwordState[1];

	const errorState: [string | null, (value: string | null) => void] = useState<string | null>(null);
	const setError: (value: string | null) => void = errorState[1];

	const showForgotState: [boolean, (value: boolean) => void] = useState<boolean>(false);
	const setShowForgot: (value: boolean) => void = showForgotState[1];

	const forgotInfoState: [string | null, (value: string | null) => void] = useState<string | null>(null);
	const setForgotInfo: (value: string | null) => void = forgotInfoState[1];

	const handleSubmit: () => Promise<void> = async () =>
	{
		try
		{
			const response: APIEndPoint.ResponseForAction<typeof APIEndPoint.ActionRequest.Login> = await ClientRequestFunctions.clientTryLoginRequest(identifierState[0], passwordState[0]);
			router.push("/");
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
			return;
		}
	};

	const handleForgotSubmit: () => Promise<void> = async () =>
	{
		try
		{
			await ClientRequestFunctions.clientTryRequestPasswordResetRequest(identifierState[0]);
		}
		catch (error: unknown)
		{
			console.error("⚠️:", error);
		}

		setForgotInfo("If an account with that username or email exists, a password reset link has been sent.");
	};

	const errorElement: ReactElement | null = errorState[0] !== null
		? <div className="text-red-500">{errorState[0]}</div>
		: null;

	const forgotInfoElement: ReactElement | null = forgotInfoState[0] !== null
		? <div className="text-green-500">{forgotInfoState[0]}</div>
		: null;

	const forgotSectionElement: ReactElement = showForgotState[0] === true
		?
		(
			<div className="flex flex-col gap-2 border-t border-gray-700 pt-4">
				<span className="text-sm text-gray-300">Enter your username or email to receive a reset link.</span>
				{forgotInfoElement}
				<button
					onClick={handleForgotSubmit}
					className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
				>
					Send reset link
				</button>
				<button onClick={() => setShowForgot(false)} className="text-blue-500 underline text-sm self-start">
					Back to log in
				</button>
			</div>
		)
		:
		(
			<button onClick={() => setShowForgot(true)} className="text-blue-500 underline text-sm self-start">
				Forgot password?
			</button>
		);

	const pageElement: ReactElement =
	(
		<main className="p-8 flex flex-col gap-4 max-w-md">
			<h1 className="text-2xl font-bold">Log in</h1>
			<input
				type="text"
				placeholder="Username or email"
				value={identifierState[0]}
				onChange={(e) => setIdentifier(e.target.value)}
				className="border border-gray-400 px-2 py-1 rounded bg-white text-black placeholder:text-gray-400"
			/>
			<input
				type="password"
				placeholder="Password"
				value={passwordState[0]}
				onChange={(e) => setPassword(e.target.value)}
				className="border border-gray-400 px-2 py-1 rounded bg-white text-black placeholder:text-gray-400"
			/>
			{errorElement}
			<button
				onClick={handleSubmit}
				className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
			>
				Log in
			</button>
			{forgotSectionElement}
			<a href="/register" className="text-blue-500 underline">
				Need an account? Register
			</a>
		</main>
	);

	return pageElement;
}
