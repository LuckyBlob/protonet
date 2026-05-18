"use client";

import * as PlayerDataType from "@/lib/playerData/playerDataTypes";
import * as UseClientDataState from "@/lib/use/useClientDataState";

const SELECTED_PLANET_STORAGE_KEY: string = "protonet.selectedPlanetId";

export function updateStoredSelectedPlanetId(playerData: PlayerDataType.PlayerData, oldId: number): number
{
    const storedId: number | null = readStoredSelectedPlanetId();
    const validateddId: number = validateSelectedPlanetId(playerData.fullPlanetDatas, storedId);

    if (validateddId === oldId)
    {
        return validateddId;
    }

    writeStoredSelectedPlanetId(validateddId);
    return validateddId;
}

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

function validateSelectedPlanetId(fullPlanetDatas: PlayerDataType.FullPlanetData[], candidateId: number | null): number
{
    if (fullPlanetDatas.length === 0)
    {
		throw Error(`Player has no planets!`);
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
    const resolvedId: number = validateSelectedPlanetId(fullPlanetDatas, playerState.selectedPlanetId);

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