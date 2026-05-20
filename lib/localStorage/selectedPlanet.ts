"use client";

import * as PlayerDataType from "@/lib/playerData/playerDataTypes";
import * as PlayerData from "@/lib/playerData/thingData/playerData";
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

function getRelevantSelectedPlanetId(fullPlanetDatas: PlayerDataType.FullPlanetData[], candidateId: number | null): number
{
    if (fullPlanetDatas.length === 0)
    {
		throw Error(`Player has no planets!`);
	}

    if (candidateId === null)
    {
        return fullPlanetDatas[0].planetRow.id;
    }

    return PlayerData.getFullPlanetDataForId(fullPlanetDatas, candidateId)?.planetRow.id ?? fullPlanetDatas[0].planetRow.id;
}

export function getSelectedFullPlanetDataPredicted(playerState: PlayerDataType.PlayerState): PlayerDataType.FullPlanetData
{
    if (playerState === undefined || playerState.predictedDBData === undefined)
    {
        throw Error(`Player state or player predicted state is invalid for selected planet data.`);
    }

    const fullPlanetDatas: PlayerDataType.FullPlanetData[] | undefined = playerState.predictedDBData.fullPlanetDatas;
    if (fullPlanetDatas === undefined || fullPlanetDatas.length === 0)
    {
        throw Error(`Player state or player predicted state is invalid for selected planet data.`);
    }

    const resolvedId: number = getRelevantSelectedPlanetId(fullPlanetDatas, playerState.selectedPlanetId);

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