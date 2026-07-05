"use client";

import { useRouter } from "next/navigation";
import { ReactElement } from "react";

import * as ErrorHelp from "@/lib/helper/errorHelp";
import * as ClientRequestFunctions from "@/lib/networkRequests/client/clientRequestFunctions";
import * as HelperElements from "@/components/helpers/helperElements";
import * as UseCurrentUser from "@/lib/use/useCurrentUser";

type VerifyPendingViewProps =
{
	cuController: UseCurrentUser.CUController;
};

export function VerifyPendingView(props: VerifyPendingViewProps): ReactElement
{
	const router: ReturnType<typeof useRouter> = useRouter();
	const feedbackController: HelperElements.ActionFeedbackController = HelperElements.useActionFeedback();

	const email: string = props.cuController[0].user?.email ?? "your email";

	const handleResend = async (): Promise<void> =>
	{
		try
		{
			await ClientRequestFunctions.clientTryResendVerificationRequest();
			feedbackController.showSuccess("Verification email sent. Check your inbox.");
		}
		catch (error: unknown)
		{
			feedbackController.showError(ErrorHelp.getErrorMessage(error));
		}
	};

	const handleLogout = async (): Promise<void> =>
	{
		await ClientRequestFunctions.clientTryLogoutRequest();
		router.push("/login");
	};

	const verifyPendingElement: ReactElement =
	(
		<main className="p-8 flex flex-col gap-4 max-w-md mx-auto">
			<h1 className="text-2xl font-bold">Verify your account</h1>
			<p className="text-gray-300">
				We sent a verification link to <span className="font-semibold">{email}</span>. Click it to activate your
				account and start playing.
			</p>
			{HelperElements.renderActionFeedback(feedbackController)}
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
