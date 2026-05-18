"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import * as ServerRequest from "@/lib/serverRequests/serverRequests"
import * as RequestType from "@/lib/serverRequests/requestTypes";
import { ActionRequest } from "@/app/api/apiEndPoints"

export default function LoginPage()
{
	const router = useRouter();

	const usernameState: [string, (value: string) => void] = useState<string>("");
	const setUsername: (value: string) => void = usernameState[1];

	const passwordState: [string, (value: string) => void] = useState<string>("");
	const setPassword: (value: string) => void = passwordState[1];

	const errorState: [string | null, (value: string | null) => void] = useState<string | null>(null);
	const setError: (value: string | null) => void = errorState[1];

	const handleSubmit: () => Promise<void> = async () =>
	{
		const authenticationData: RequestType.BaseAuthenticationClientRequest =
		{
			username: usernameState[0],
			password: passwordState[0],
		}
		const serverResponse: RequestType.BaseServerResponse = await ServerRequest.requestServerAction(ActionRequest.Login, authenticationData);
		if (serverResponse.error !== null)
		{
			setError(serverResponse.error);
			return;
		}

		router.push("/");
	};

	const errorElement: React.ReactElement | null = errorState[0] !== null
		? <div className="text-red-500">{errorState[0]}</div>
		: null;

	const pageElement: React.ReactElement =
	(
		<main className="p-8 flex flex-col gap-4 max-w-md">
			<h1 className="text-2xl font-bold">Log in</h1>
			<input
				type="text"
				placeholder="Username"
				value={usernameState[0]}
				onChange={(e) => setUsername(e.target.value)}
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
			<a href="/register" className="text-blue-500 underline">
				Need an account? Register
			</a>
		</main>
	);

	return pageElement;
}