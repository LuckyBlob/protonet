"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ReactElement } from "react";

import * as UseClientDataState from "@/lib/use/useClientDataState";
import * as UseCurrentUser from "@/lib/use/useCurrentUser";
import * as ClientRequestFunctions from "@/lib/networkRequests/client/clientRequestFunctions";
import * as HelperElements from "@/components/helpers/helperElements";
import * as InlineTextEditor from "@/components/helpers/inlineTextEditor";
import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as DBType from "@/lib/db/dbTypes";
import * as APIEndPoint from "@/app/api/apiEndPoints";
import * as PlayerSettings from "@/lib/gameplay/dynamicData/player/playerSettingsData";

type PlayerSettingsViewProps =
{
	clientDataStateResult: UseClientDataState.ClientDataStateResult;
	cuController: UseCurrentUser.CUController;
};

type AccountFeedback =
{
	message: string;
	isError: boolean;
};

type AccountFeedbackController = [AccountFeedback | null, (value: AccountFeedback | null) => void];

//#region rendering helpers

function renderGameSection(props: PlayerSettingsViewProps): ReactElement
{
	const playerData: CoreType.PlayerData = props.clientDataStateResult.psController[0].predictedDBData;
	const currentProbesPerSend: number = PlayerSettings.getProbesPerSend(playerData);

	const handleSaveProbesPerSend = (value: string): void =>
	{
		const parsedValue: number = Number.parseInt(value, 10);
		const probesPerSend: number = Number.isNaN(parsedValue) === true ? 1 : parsedValue;
		ClientRequestFunctions.clientTryUpdatePlayerSettingsRequest(props.clientDataStateResult.psController, probesPerSend);
	};

	const element: ReactElement =
	(
		<section className="flex flex-col gap-2 w-full max-w-md">
			<h2 className="text-lg font-bold text-white border-b border-gray-600 pb-1">Game</h2>
			<InlineTextEditor.InlineTextEditor
				key={currentProbesPerSend}
				label="Probes per send:"
				initialValue={String(currentProbesPerSend)}
				placeholder="1"
				saveLabel="Save"
				inputType="number"
				min={1}
				onSave={handleSaveProbesPerSend}
			/>
		</section>
	);

	return element;
}

function renderAccountSection(props: PlayerSettingsViewProps, router: ReturnType<typeof useRouter>, feedbackController: AccountFeedbackController): ReactElement
{
	const user: DBType.UserRow | null = props.cuController[0].user;
	const currentEmail: string = user?.email ?? "";
	const currentUsername: string = user?.username ?? "";

	const feedback: AccountFeedback | null = feedbackController[0];
	const setFeedback: (value: AccountFeedback | null) => void = feedbackController[1];

	const applyUpdatedUser = (updatedUser: DBType.UserRow | null): void =>
	{
		if (updatedUser === null)
		{
			return;
		}

		const currentUserResult: UseCurrentUser.CurrentUserResult =
		{
			user: updatedUser,
			isLoading: false,
		};
		props.cuController[1](currentUserResult);
	};

	const handleSaveEmail = async (value: string): Promise<void> =>
	{
		try
		{
			const response: APIEndPoint.ResponseForAction<typeof APIEndPoint.ActionRequest.ChangeEmail> = await ClientRequestFunctions.clientTryChangeEmailRequest(value);
			applyUpdatedUser(response.userRow);
			setFeedback({ message: "Email updated.", isError: false });
		}
		catch (error: unknown)
		{
			setFeedback({ message: error instanceof Error ? error.message : "Could not change email.", isError: true });
		}
	};

	const handleSaveUsername = async (value: string): Promise<void> =>
	{
		try
		{
			const response: APIEndPoint.ResponseForAction<typeof APIEndPoint.ActionRequest.ChangeUsername> = await ClientRequestFunctions.clientTryChangeUsernameRequest(value);
			applyUpdatedUser(response.userRow);
			setFeedback({ message: "Username updated.", isError: false });
		}
		catch (error: unknown)
		{
			setFeedback({ message: error instanceof Error ? error.message : "Could not change username.", isError: true });
		}
	};

	const feedbackElement: ReactElement | null = feedback === null
		? null
		: <div className={`text-sm ${feedback.isError === true ? "text-red-500" : "text-green-500"}`}>{feedback.message}</div>;

	const element: ReactElement =
	(
		<section className="flex flex-col gap-3 w-full max-w-md">
			<h2 className="text-lg font-bold text-white border-b border-gray-600 pb-1">Account</h2>
			<InlineTextEditor.InlineTextEditor
				key={`email-${currentEmail}`}
				label="Email:"
				initialValue={currentEmail}
				placeholder="you@example.com"
				saveLabel="Save"
				inputType="email"
				onSave={handleSaveEmail}
			/>
			<InlineTextEditor.InlineTextEditor
				key={`username-${currentUsername}`}
				label="Username:"
				initialValue={currentUsername}
				placeholder="Username"
				saveLabel="Save"
				inputType="text"
				onSave={handleSaveUsername}
			/>
			{feedbackElement}
			{renderDeleteAccountButton(router)}
		</section>
	);

	return element;
}

function renderDeleteAccountButton(router: ReturnType<typeof useRouter>): ReactElement
{
	const handleDeleteAccount = async (): Promise<void> =>
	{
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
			className="border border-gray-400 px-3 py-1 rounded bg-red-600 hover:bg-red-500 text-white text-sm font-semibold self-start mt-2"
		>
			Delete account
		</button>
	);

	return buttonElement;
}

//#endregion

export function PlayerSettingsView(props: PlayerSettingsViewProps): ReactElement
{
	const router: ReturnType<typeof useRouter> = useRouter();
	const feedbackController: AccountFeedbackController = useState<AccountFeedback | null>(null);

	try
	{
		const playerSettingsViewElement: ReactElement =
		(
			<div className="flex flex-col items-center gap-8 pt-4">
				{renderGameSection(props)}
				{renderAccountSection(props, router, feedbackController)}
			</div>
		);

		return playerSettingsViewElement;
	}
	catch (error: unknown)
	{
		console.error("⚠️:", error);
		return <HelperElements.EmptyElement />;
	}
}
