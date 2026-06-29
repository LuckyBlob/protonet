"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ReactElement } from "react";

import * as ClientRequestFunctions from "@/lib/networkRequests/client/clientRequestFunctions";
import * as UseCurrentUser from "@/lib/use/useCurrentUser";

type VerifyPendingViewProps =
{
	cuController: UseCurrentUser.CUController;
};

export function VerifyPendingView(props: VerifyPendingViewProps): ReactElement
{
	const router: ReturnType<typeof useRouter> = useRouter();

	const infoState: [string | null, (value: string | null) => void] = useState<string | null>(null);
	const setInfo: (value: string | null) => void = infoState[1];

	const email: string = props.cuController[0].user?.email ?? "your email";

	const handleResend = async (): Promise<void> =>
	{
		try
		{
			await ClientRequestFunctions.clientTryResendVerificationRequest();
			setInfo("Verification email sent. Check your inbox.");
		}
		catch (error: unknown)
		{
			setInfo(error instanceof Error ? error.message : "Could not send the verification email.");
		}
	};

	const handleLogout = async (): Promise<void> =>
	{
		await ClientRequestFunctions.clientTryLogoutRequest();
		router.push("/login");
	};

	const infoElement: ReactElement | null = infoState[0] !== null
		? <div className="text-green-500">{infoState[0]}</div>
		: null;

	const verifyPendingElement: ReactElement =
	(
		<main className="p-8 flex flex-col gap-4 max-w-md mx-auto">
			<h1 className="text-2xl font-bold">Verify your account</h1>
			<p className="text-gray-300">
				We sent a verification link to <span className="font-semibold">{email}</span>. Click it to activate your
				account and start playing.
			</p>
			{infoElement}
			<button
				onClick={handleResend}
				className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 self-start"
			>
				Send verification email
			</button>
			<button
				onClick={handleLogout}
				className="px-4 py-2 border border-gray-400 rounded hover:bg-gray-700 self-start"
			>
				Log out
			</button>
		</main>
	);

	return verifyPendingElement;
}
