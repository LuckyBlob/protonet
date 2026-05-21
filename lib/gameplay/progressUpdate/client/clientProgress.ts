"use client";

import * as UseClientDataState from "@/lib/use/useClientDataState";
import * as AnchorEvent from "@/lib/gameplay/progressUpdate/anchorEvent"
import * as PlayerDataType from "@/lib/gameplay/gameplayData/player/playerDataTypes";
import * as ClientRequestFunctions from "@/lib/networkRequests/client/clientRequestFunctions";
import * as BuildingUpgrade from "@/lib/gameplay/progressUpdate/anchorEvent/buildingUpgradeAnchorEvent"
import * as ApplyProgress from "@/lib/gameplay/progressUpdate/applyProgress"

export class ClientProgressResolver extends AnchorEvent.ProgressResolver{}

export function runClientTick(clientDataStateResult: UseClientDataState.ClientDataStateResult): void
{
    const now: number = Date.now();
    const clientProgressResolver: ClientProgressResolver = new ClientProgressResolver();

    const updatedPlayerData: PlayerDataType.PlayerData = ApplyProgress.applyProgressToPlayerData(clientDataStateResult.psController[0].dbData, clientDataStateResult.sdsController[0], now, clientProgressResolver);

    ClientRequestFunctions.setPredictedPlayerState(clientDataStateResult.psController, updatedPlayerData);
}
