"use client";

import { useEffect } from "react";

import * as UseClientDataState from "@/lib/use/useClientDataState";

import * as PlanetUpdateClient from "@/lib/update/client/planetUpdateClient";

export function useSelectedPlanet(clientDataStateResult: UseClientDataState.ClientDataStateResult): void
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