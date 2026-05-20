"use client";

import * as LoadingElement from "@/components/layout/loadingElement";
import * as MainPageContent from "@/components/mainPage/mainPageContent";

import * as UseAnimationTimer from "@/lib/use/useAnimationTimer";
import * as UseCurrentView from "@/lib/use/useCurrentView";
import * as UseClientDataState from "@/lib/use/useClientDataState";
import * as UseCurrentUser from "@/lib/use/useCurrentUser";

import * as Actions from "@/lib/mainPageHelpers/actions"

export default function Home()
{
	const cuController: UseCurrentUser.CUController = UseCurrentUser.useCurrentUser();
	const clientDataStateResult: UseClientDataState.ClientDataStateResult = UseClientDataState.useClientDataState(cuController[0].user !== null);
	const cvController: UseCurrentView.CVController = UseCurrentView.useCurrentView();


	UseAnimationTimer.useAnimationTimer(clientDataStateResult);

	if (Actions.shouldShowLoading(cuController, clientDataStateResult))
	{
		return <LoadingElement.LoadingElement />;
	}

	return (
		<MainPageContent.MainPageContent
			cuController={cuController}
			cvController={cvController}
			clientDataStateResult={clientDataStateResult}
		/>
	);
}
