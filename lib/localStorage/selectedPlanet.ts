import { PlanetRow } from "@/lib/db/dbTypes";
import * as UseLoadClientDataState from "@/lib/use/useLoadClientDataState";
import * as PlayerDataType from "@/lib/playerData/playerDataTypes"

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

export function resolveSelectedPlanetId(planetRows: PlanetRow[], candidateId: number | null): number | null
{
	if (planetRows.length === 0)
	{
		return null;
	}

	if (candidateId !== null)
	{
		const matchingPlanet: PlanetRow | undefined = planetRows.find((planetRow: PlanetRow) =>
		{
			return planetRow.id === candidateId;
		});

		if (matchingPlanet !== undefined)
		{
			return matchingPlanet.id;
		}
	}

	const firstPlanet: PlanetRow = planetRows[0];

	return firstPlanet.id;
}

export function getSelectedPlanetRow(playerState: PlayerDataType.PlayerState): PlanetRow
{
	const planetRows: PlanetRow[] = playerState.predictedDBData.planetRows;

	const matchingPlanet: PlanetRow | undefined = planetRows.find((planetRow: PlanetRow) =>
	{
		return planetRow.id === playerState.selectedPlanetId;
	});

	if (matchingPlanet !== undefined)
	{
		return matchingPlanet;
	}

	return planetRows[0];
}

export function setSelectedPlanetInPlayerState(clientDataStateResult: UseLoadClientDataState.ClientDataStateResult, requestedPlanetId: number): void
{
    if (clientDataStateResult.lsController[0].isLoading)
    {
        return;
    }

    const planetRows: PlanetRow[] = clientDataStateResult.psController[0].predictedDBData.planetRows;
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