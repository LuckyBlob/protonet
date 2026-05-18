"use client";

import * as PlayerDataType from "@/lib/playerData/playerDataTypes";
import * as PlayerDataSerialization from "@/lib/playerData/playerDataSerialization";

const PLAYER_DATA_LOCAL_STORAGE_KEY: string = "protonet.playerDataLocalStorageKey";

export function updatePlayerDataToLocalStorage(playerData: PlayerDataType.PlayerData): boolean
{
	const oldPlayerData: PlayerDataType.PlayerData | null = readPlayerDataFromLocalStorage();
    if (playerData === null)
    {
        throw Error(`Could not read player data from local storage when updating.`);
    }

    try
    {
        writePlayerDataToLocalStorage(playerData);
        return true;
    }
    catch
    {
        return false;
    }
}

function readPlayerDataFromLocalStorage(): PlayerDataType.PlayerData | null
{
	if (typeof window === "undefined")
	{
		throw Error(`No window for local storage.`);
	}

	const rawValue: string | null = window.localStorage.getItem(PLAYER_DATA_LOCAL_STORAGE_KEY);

	if (rawValue === null)
	{
		throw Error(`No window for local storage.`);
	}

    try
    {
        const serializedData = JSON.parse(rawValue) as PlayerDataSerialization.SerializedPlayerData;
        const playerData: PlayerDataType.PlayerData = PlayerDataSerialization.deserializePlayerData(serializedData);
        return playerData;
    }
    catch (error: unknown)
    {
        console.error("Failed to parse local storage data:", error);
        return null;
    }
}

function writePlayerDataToLocalStorage(playerData: PlayerDataType.PlayerData): void
{
	if (typeof window === "undefined")
	{
		throw Error(`No window for local storage.`);
	}

	window.localStorage.setItem(PLAYER_DATA_LOCAL_STORAGE_KEY, JSON.stringify(PlayerDataSerialization.serializePlayerData(playerData)));
}