"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import * as AuthClient from "@/lib/authentication/authClient";

export default function RegisterPage()
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
		const result: AuthClient.AuthResult = await AuthClient.tryRegister(usernameState[0], passwordState[0]);

		if (result.success === false)
		{
			setError(result.errorMessage);
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
			<h1 className="text-2xl font-bold">Register</h1>
			<input
				type="text"
				placeholder="Username (3+ chars)"
				value={usernameState[0]}
				onChange={(e) => setUsername(e.target.value)}
				className="border px-2 py-1 rounded"
			/>
			<input
				type="password"
				placeholder="Password (6+ chars)"
				value={passwordState[0]}
				onChange={(e) => setPassword(e.target.value)}
				className="border px-2 py-1 rounded"
			/>
			{errorElement}
			<button
				onClick={handleSubmit}
				className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
			>
				Register
			</button>
			<a href="/login" className="text-blue-500 underline">
				Already have an account? Log in
			</a>
		</main>
	);

	return pageElement;
}