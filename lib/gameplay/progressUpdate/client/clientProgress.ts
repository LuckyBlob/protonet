"use client";

import * as UseClientDataState from "@/lib/use/useClientDataState";
import * as AnchorEvent from "@/lib/gameplay/progressUpdate/anchorEvent"
import * as PlayerDataType from "@/lib/playerData/playerDataTypes";
import * as ServerDataType from "@/lib/serverData/serverDataTypes";
import * as BuildingUpgrade from "@/lib/gameplay/progressUpdate/anchorEvent/buildingUpgradeAnchorEvent"
import * as ApplyProgress from "@/lib/gameplay/progressUpdate/applyProgress"

export class ClientProgressResolver extends AnchorEvent.ProgressResolver{}

export function runClientTick(clientDataStateResult: UseClientDataState.ClientDataStateResult): void
{
    const now: number = Date.now();
    const clientProgressResolver: ClientProgressResolver = new ClientProgressResolver();

    const updatedPlayerData: PlayerDataType.PlayerData = ApplyProgress.applyProgressToPlayerData(clientDataStateResult.psController[0].dbData, clientDataStateResult.sdsController[0], now, clientProgressResolver);

    const playerState: PlayerDataType.PlayerState = clientDataStateResult.psController[0];
    const updatedPlayerState: PlayerDataType.PlayerState =
    {
        ...playerState,
        predictedDBData: updatedPlayerData,
    };
    clientDataStateResult.psController[1](updatedPlayerState);
}