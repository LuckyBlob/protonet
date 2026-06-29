"use client";

import * as LoadingElement from "@/components/layout/loadingElement";
import * as MainPageContent from "@/components/mainPage/mainPageContent";
import * as VerifyPendingView from "@/components/views/verifyPendingView";

import * as UseAnimationTimer from "@/lib/use/useAnimationTimer";
import * as UseCurrentView from "@/lib/use/useCurrentView";
import * as UseClientDataState from "@/lib/use/useClientDataState";
import * as UseCurrentUser from "@/lib/use/useCurrentUser";


export default function Home()
{
	const cuController: UseCurrentUser.CUController = UseCurrentUser.useCurrentUser();
	const accountIsVerified: boolean = cuController[0].user !== null && cuController[0].user.email_verified === 1;
	const clientDataStateResult: UseClientDataState.ClientDataStateResult = UseClientDataState.useClientDataState(accountIsVerified);
	const cvController: UseCurrentView.CVController = UseCurrentView.useCurrentView();

	UseAnimationTimer.useAnimationTimer(clientDataStateResult);

	if (cuController[0].isLoading === true)
	{
		return <LoadingElement.LoadingElement error={clientDataStateResult.lsController[0].error} />;
	}

	if (cuController[0].user !== null && accountIsVerified === false)
	{
		return <VerifyPendingView.VerifyPendingView cuController={cuController} />;
	}

	if (MainPageContent.shouldShowLoading(cuController, clientDataStateResult))
	{
		return <LoadingElement.LoadingElement error={clientDataStateResult.lsController[0].error} />;
	}

	return (
		<MainPageContent.MainPageContent
			cuController={cuController}
			cvController={cvController}
			clientDataStateResult={clientDataStateResult}
		/>
	);
}
