"use client";

import * as PlayerDataType from "@/lib/playerData/playerDataTypes";
import * as PlayerDataSerialization from "@/lib/helper/serialization";

const PLAYER_STATE_LOCAL_STORAGE_KEY: string = "protonet.playerDataLocalStorageKey";

export function updatePlayerStateToLocalStorage(playerData: PlayerDataType.PlayerState): boolean
{
	const oldPlayerState: PlayerDataType.PlayerState | null = readPlayerStateFromLocalStorage();
    if (oldPlayerState === null)
    {
        throw Error(`Could not read player state from local storage when updating.`);
    }

    try
    {
        writePlayerStateToLocalStorage(playerData);
        return true;
    }
    catch
    {
        return false;
    }
}

function readPlayerStateFromLocalStorage(): PlayerDataType.PlayerState | null
{
	if (typeof window === "undefined")
	{
		throw Error(`No window for local storage.`);
	}

	const rawValue: string | null = window.localStorage.getItem(PLAYER_STATE_LOCAL_STORAGE_KEY);

	if (rawValue === null)
	{
		throw Error(`No window for local storage.`);
	}

    try
    {
        const serializedData = JSON.parse(rawValue) as PlayerDataSerialization.SerializedPlayerState;
        const playerState: PlayerDataType.PlayerState = PlayerDataSerialization.deserializePlayerState(serializedData);
        return playerState;
    }
    catch (error: unknown)
    {
        console.error("Failed to parse local storage data:", error);
        return null;
    }
}

function writePlayerStateToLocalStorage(playerState: PlayerDataType.PlayerState): void
{
	if (typeof window === "undefined")
	{
		throw Error(`No window for local storage.`);
	}

	window.localStorage.setItem(PLAYER_STATE_LOCAL_STORAGE_KEY, JSON.stringify(PlayerDataSerialization.serializePlayerState(playerState)));
}