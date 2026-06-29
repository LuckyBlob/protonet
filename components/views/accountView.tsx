"use client";

import { useRouter } from "next/navigation";
import { ReactElement } from "react";

import * as UseClientDataState from "@/lib/use/useClientDataState";
import * as UseCurrentUser from "@/lib/use/useCurrentUser";
import * as ClientRequestFunctions from "@/lib/networkRequests/client/clientRequestFunctions";
import * as HelperElements from "@/components/helpers/helperElements";

type AccountViewProps =
{
	clientDataStateResult: UseClientDataState.ClientDataStateResult;
	cuController: UseCurrentUser.CUController;
};

function renderDeleteAccountButton(props: AccountViewProps, router: ReturnType<typeof useRouter>): ReactElement
{
	const handleDeleteAccount = async (): Promise<void> =>
	{
		const username: string | undefined = props.cuController[0].user?.username;
		if (username === undefined)
		{
			console.error("⚠️:", "Cannot delete account: username unavailable.");
			return;
		}

		try
		{
			await ClientRequestFunctions.clientTryDeleteUserRequest();
			router.push("/login");
		}
		catch (error: unknown)
		{
			console.error("⚠️:", error);
		}
	};

	const buttonElement: ReactElement =
	(
		<button
			type="button"
			onClick={handleDeleteAccount}
			className="border border-gray-400 px-3 py-1 rounded bg-red-600 hover:bg-red-500 text-white text-sm font-semibold"
		>
			Delete account
		</button>
	);

	return buttonElement;
}

export function AccountView(props: AccountViewProps): ReactElement
{
	const router: ReturnType<typeof useRouter> = useRouter();

	try
	{
		const accountViewElement: ReactElement =
		(
			<div className="flex flex-col items-center gap-4">
				{renderDeleteAccountButton(props, router)}
			</div>
		);

		return accountViewElement;
	}
	catch (error: unknown)
	{
		console.error("⚠️:", error);
		return <HelperElements.EmptyElement />;
	}
}
