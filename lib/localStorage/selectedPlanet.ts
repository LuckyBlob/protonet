import * as DBTypes from "@/lib/db/dbTypes";

import * as PlayerDataType from "@/lib/playerData/playerDataTypes";

import * as UseClientDataState from "@/lib/use/useClientDataState";

const SELECTED_PLANET_STORAGE_KEY: string = "protonet.selectedPlanetId";

export function readStoredSelectedPlanetId(): number | null
{
	if (typeof window === "undefined")
	{
		return null;
	}

	const rawValue: string | null = window.localStorage.getItem(SELECTED_PLANET_STORAGE_KEY);

	if (rawValue === null)
	{
		return null;
	}

	const parsedValue: number = Number.parseInt(rawValue, 10);

	if (Number.isNaN(parsedValue) === true)
	{
		return null;
	}

	return parsedValue;
}

export function writeStoredSelectedPlanetId(planetId: number): void
{
	if (typeof window === "undefined")
	{
		return;
	}

	window.localStorage.setItem(SELECTED_PLANET_STORAGE_KEY, String(planetId));
}

export function resolveSelectedPlanetId(planetRows: DBTypes.PlanetRow[], candidateId: number | null): number | null
{
	if (planetRows.length === 0)
	{
		return null;
	}

	if (candidateId !== null)
	{
		const matchingPlanet: DBTypes.PlanetRow | undefined = planetRows.find((planetRow: DBTypes.PlanetRow) =>
		{
			return planetRow.id === candidateId;
		});

		if (matchingPlanet !== undefined)
		{
			return matchingPlanet.id;
		}
	}

	const firstPlanet: DBTypes.PlanetRow = planetRows[0];

	return firstPlanet.id;
}

export function getSelectedPlanetRow(playerState: PlayerDataType.PlayerState): DBTypes.PlanetRow
{
	const planetRows: DBTypes.PlanetRow[] = playerState.predictedDBData.planetRows;

	const matchingPlanet: DBTypes.PlanetRow | undefined = planetRows.find((planetRow: DBTypes.PlanetRow) =>
	{
		return planetRow.id === playerState.selectedPlanetId;
	});

	if (matchingPlanet !== undefined)
	{
		return matchingPlanet;
	}

	return planetRows[0];
}

export function setSelectedPlanetInPlayerState(clientDataStateResult: UseClientDataState.ClientDataStateResult, requestedPlanetId: number): void
{
	if (clientDataStateResult.lsController[0].isLoading)
	{
		return;
	}

	const planetRows: DBTypes.PlanetRow[] = clientDataStateResult.psController[0].predictedDBData.planetRows;
	const resolvedId: number | null = resolveSelectedPlanetId(planetRows, requestedPlanetId);

	if (resolvedId === null)
	{
		return;
	}

	if (resolvedId === clientDataStateResult.psController[0].selectedPlanetId)
	{
		return;
	}

	writeStoredSelectedPlanetId(resolvedId);

	const updatedPlayerState: PlayerDataType.PlayerState =
	{
		...clientDataStateResult.psController[0],
		selectedPlanetId: resolvedId,
	};

	clientDataStateResult.psController[1](updatedPlayerState);
}