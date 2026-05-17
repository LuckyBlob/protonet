"use client";

import * as DBType from "@/lib/db/dbTypes";

import * as PlayerDataType from "@/lib/playerData/playerDataTypes";

import * as UseClientDataState from "@/lib/use/useClientDataState";
import * as PlanetData from "@/lib/playerData/planetData";

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

export function resolveSelectedPlanetId(fullPlanetDatas: PlanetData.FullPlanetData[], candidateId: number | null): number | null
{
	if (fullPlanetDatas.length === 0)
	{
		return null;
	}

	if (candidateId !== null)
	{
		const matchingPlanet: PlanetData.FullPlanetData | undefined = fullPlanetDatas.find((fullPlanetData: PlanetData.FullPlanetData) =>
		{
			return fullPlanetData.planetRow.id === candidateId;
		});

		if (matchingPlanet !== undefined)
		{
			return matchingPlanet.planetRow.id;
		}
	}

	const firstPlanet: PlanetData.FullPlanetData = fullPlanetDatas[0];

	return firstPlanet.planetRow.id;
}

export function getSelectedFullPlanetDataPredicted(playerState: PlayerDataType.PlayerState): PlanetData.FullPlanetData
{
	const fullPlanetDatas: PlanetData.FullPlanetData[] = playerState.predictedDBData.fullPlanetDatas;
	const resolvedId: number | null = resolveSelectedPlanetId(fullPlanetDatas, playerState.selectedPlanetId);
	if (resolvedId === null)
	{
		return fullPlanetDatas[0];
	}

	const matchingFullPlanetData: PlanetData.FullPlanetData | undefined = fullPlanetDatas.find((fullPlanetData: PlanetData.FullPlanetData): boolean =>
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

	const fullPlanetDatas: PlanetData.FullPlanetData[] = clientDataStateResult.psController[0].predictedDBData.fullPlanetDatas;
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