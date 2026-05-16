"use client";

import * as DBType from "@/lib/db/dbTypes";

import * as UseClientDataState from "@/lib/use/useClientDataState";

import * as PlanetUpdateClient from "@/lib/update/client/planetUpdateClient";

export function replacePlanetRowInArrayByUpdatedPlanetRow(planetRows: DBType.PlanetRow[], updatedPlanetRow: DBType.PlanetRow): DBType.PlanetRow[]
{
	const newPlanetRows: DBType.PlanetRow[] = planetRows.map((planetRow: DBType.PlanetRow): DBType.PlanetRow =>
	{
		if (planetRow.id === updatedPlanetRow.id)
		{
			return updatedPlanetRow;
		}

		return planetRow;
	});

	return newPlanetRows;
}

export function runClientTick(clientDataStateResult: UseClientDataState.ClientDataStateResult): void
{
	PlanetUpdateClient.updatePlanetPredictedData(clientDataStateResult);
}