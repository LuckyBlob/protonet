"use client";

import * as PlanetUpdateClient from "@/lib/update/client/planetUpdateClient";
import * as DBType from "@/lib/db/dbTypes";
import * as UseLoadClientDataState from "@/lib/use/useLoadClientDataState";

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

export function runClientTick(clientDataStateResult: UseLoadClientDataState.ClientDataStateResult): void
{
	PlanetUpdateClient.updatePlanetPredictedData(clientDataStateResult);
}