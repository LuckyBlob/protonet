"use client";

import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";

const SELECTED_PLANET_STORAGE_KEY: string = "protonet.selectedPlanetId";

export function updateSelectedPlanetIdInStorage(newPlayerData: CoreType.PlayerData): number
{
    const storedSelectedPlanetId: number | null = readStoredSelectedPlanetId();
    const resolvedSelectedPlanetId: number = getRelevantSelectedPlanetId(newPlayerData.planetDatas, storedSelectedPlanetId);

    if (resolvedSelectedPlanetId !== storedSelectedPlanetId)
    {
        writeStoredSelectedPlanetId(resolvedSelectedPlanetId);
    }

    return resolvedSelectedPlanetId;
}

export function setSelectedPlanetID(psController: CoreType.PSController, selectedPlanetId: number): void
{
    writeStoredSelectedPlanetId(selectedPlanetId);
    psController[1]((mostRecentState: CoreType.PlayerState): CoreType.PlayerState =>
    {
        const newPlayerState: CoreType.PlayerState =
        {
            dbData: mostRecentState.dbData,
            predictedDBData: mostRecentState.predictedDBData,
            selectedPlanetId: selectedPlanetId,
            lastFetchTimestamp: Date.now(),
        };
        return newPlayerState;
    });
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

function getRelevantSelectedPlanetId(planetDatas: CoreType.PlanetData[], candidateId: number | null): number
{
    if (planetDatas.length === 0)
    {
		throw new Error(`Player has no planets!`);
	}

    // Default to a real planet rather than a moon/debris row when there's no valid stored choice.
    const ownedPlanets: CoreType.PlanetData[] = CoreType.getOwnedPlanets(planetDatas);
    const defaultPlanetData: CoreType.PlanetData = ownedPlanets.length > 0 ? ownedPlanets[0] : planetDatas[0];

    if (candidateId === null)
    {
        return defaultPlanetData.planetRow.id;
    }

    return CoreType.getPlanetDataForId(planetDatas, candidateId)?.planetRow.id ?? defaultPlanetData.planetRow.id;
}

export function getSelectedPlanetDataPredicted(playerState: CoreType.PlayerState): CoreType.PlanetData
{
    if (playerState === undefined || playerState.predictedDBData === undefined)
    {
        throw new Error(`Player state or player predicted state is invalid for selected planet data.`);
    }

    const planetDatas: CoreType.PlanetData[] | undefined = playerState.predictedDBData.planetDatas;
    if (planetDatas === undefined || planetDatas.length === 0)
    {
        throw new Error(`Player state or player predicted state is invalid for selected planet data.`);
    }

    const resolvedId: number = getRelevantSelectedPlanetId(planetDatas, playerState.selectedPlanetId);

	const matchingPlanetData: CoreType.PlanetData | undefined = planetDatas.find((planetData: CoreType.PlanetData): boolean =>
    {
        return planetData.planetRow.id === resolvedId;
    });

    if (matchingPlanetData === undefined)
    {
        return planetDatas[0];
    }

    return matchingPlanetData;
}