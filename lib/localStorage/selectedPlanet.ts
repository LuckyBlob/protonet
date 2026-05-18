"use client";

import * as PlayerDataType from "@/lib/playerData/playerDataTypes";
import * as UseClientDataState from "@/lib/use/useClientDataState";

const SELECTED_PLANET_STORAGE_KEY: string = "protonet.selectedPlanetId";

export function updateStoredSelectedPlanetId(playerData: PlayerDataType.PlayerData): number | null
{
	const storedId: number | null = readStoredSelectedPlanetId();
	const resolvedId: number | null = resolveSelectedPlanetId(playerData.fullPlanetDatas, storedId);

	if (resolvedId === null)
	{
		return null;
	}
	writeStoredSelectedPlanetId(resolvedId);

	return resolvedId;
}

function readStoredSelectedPlanetId(): number | null
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

function writeStoredSelectedPlanetId(planetId: number): void
{
	if (typeof window === "undefined")
	{
		return;
	}

	window.localStorage.setItem(SELECTED_PLANET_STORAGE_KEY, String(planetId));
}

function resolveSelectedPlanetId(fullPlanetDatas: PlayerDataType.FullPlanetData[], candidateId: number | null): number | null
{
	if (fullPlanetDatas.length === 0)
	{
		return null;
	}

	if (candidateId !== null)
	{
		const matchingPlanet: PlayerDataType.FullPlanetData | undefined = fullPlanetDatas.find((fullPlanetData: PlayerDataType.FullPlanetData) =>
		{
			return fullPlanetData.planetRow.id === candidateId;
		});

		if (matchingPlanet !== undefined)
		{
			return matchingPlanet.planetRow.id;
		}
	}

	const firstPlanet: PlayerDataType.FullPlanetData = fullPlanetDatas[0];

	return firstPlanet.planetRow.id;
}

export function getSelectedFullPlanetDataPredicted(playerState: PlayerDataType.PlayerState): PlayerDataType.FullPlanetData
{
	const fullPlanetDatas: PlayerDataType.FullPlanetData[] = playerState.predictedDBData.fullPlanetDatas;
	const resolvedId: number | null = resolveSelectedPlanetId(fullPlanetDatas, playerState.selectedPlanetId);
	if (resolvedId === null)
	{
		return fullPlanetDatas[0];
	}

	const matchingFullPlanetData: PlayerDataType.FullPlanetData | undefined = fullPlanetDatas.find((fullPlanetData: PlayerDataType.FullPlanetData): boolean =>
	{
		return fullPlanetData.planetRow.id === resolvedId;
	});

	if (matchingFullPlanetData === undefined)
	{
		return fullPlanetDatas[0];
	}

	return matchingFullPlanetData;
}

export function setSelectedPlanetInPredictedPlayerState(clientDataStateResult: UseClientDataState.ClientDataStateResult, requestedPlanetId: number): void
{
	if (clientDataStateResult.lsController[0].isLoading)
	{
		return;
	}

	const fullPlanetDatas: PlayerDataType.FullPlanetData[] = clientDataStateResult.psController[0].predictedDBData.fullPlanetDatas;
	const resolvedId: number | null = resolveSelectedPlanetId(fullPlanetDatas, requestedPlanetId);

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