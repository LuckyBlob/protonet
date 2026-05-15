"use client";

import { useEffect } from "react";

import * as UseLoadClientDataState from "@/lib/use/useLoadClientDataState";

import * as PlanetUpdateClient from "@/lib/update/client/planetUpdateClient";

export function useSelectedPlanetApplyUpdate(clientDataStateResult: UseLoadClientDataState.ClientDataStateResult): void
{
	useEffect(() =>
	{	    
		// This will fire once at the begining of the render, so we need to gate.
		if (clientDataStateResult.lsController[0].isLoading)
		{
			return;
		}

		PlanetUpdateClient.updatePlanetPredictedData(clientDataStateResult);
	}, [clientDataStateResult.psController[0].selectedPlanetId]);
}