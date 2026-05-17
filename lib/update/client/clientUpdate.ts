"use client";

import * as DBType from "@/lib/db/dbTypes";

import * as UseClientDataState from "@/lib/use/useClientDataState";

import * as PlanetUpdateClient from "@/lib/update/client/planetUpdateClient";
import * as PlanetData from "@/lib/playerData/planetData";

export function replaceFullPlanetDataInArrayByUpdatedFullPlanetData(fullPlanetDatas: PlanetData.FullPlanetData[], updatedFullPlanetData: PlanetData.FullPlanetData): PlanetData.FullPlanetData[]
{
	const newFullPlanetDatas: PlanetData.FullPlanetData[] = fullPlanetDatas.map((fullPlanetData: PlanetData.FullPlanetData): PlanetData.FullPlanetData =>
	{
		if (fullPlanetData.planetRow.id === updatedFullPlanetData.planetRow.id)
		{
			return updatedFullPlanetData;
		}

		return fullPlanetData;
	});

	return newFullPlanetDatas;
}

export function runClientTick(clientDataStateResult: UseClientDataState.ClientDataStateResult): void
{
	PlanetUpdateClient.updatePlanetPredictedData(clientDataStateResult);
}