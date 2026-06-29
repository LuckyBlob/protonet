// Pure accessors; the DB read/write for this slice lives in serverDynamicData under DataContext.PlayerSettings.
import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";

export function getProbesPerSend(playerData: CoreType.PlayerData): number
{
    return playerData.dynamicPlayerData.playerSettings.probes_per_send;
}

export function setProbesPerSend(playerData: CoreType.PlayerData, value: number): void
{
    playerData.dynamicPlayerData.playerSettings.probes_per_send = Math.max(1, Math.floor(value));
}
