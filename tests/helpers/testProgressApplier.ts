import * as ApplyProgress from "@/lib/gameplay/progressUpdate/applyProgress";
import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as FleetArrival from "@/lib/gameplay/progressUpdate/anchorEvent/fleetArrivalAnchorEvent";
import * as FleetData from "@/lib/gameplay/dynamicData/planet/fleet/fleetData";

// Minimal concrete PlayerProgressApplier for tests — pure in-memory, no DB, no fleet
// resolution. Shared by the integration tests and the anchor-event unit tests.
export class TestProgressApplier extends ApplyProgress.PlayerProgressApplier
{
    applyPlayerProgressAtTime(playerData: CoreType.PlayerData, serverData: CoreType.ServerData, _targetPlayerId: number, time: number): CoreType.PlayerData | null
    {
        return ApplyProgress.applyProgressToPlayerData(playerData, serverData, time, this);
    }

    getFleetPlayerData(_playerId: number | null, _planetId: number | null, _playerData: CoreType.PlayerData, _anchorEvent: FleetArrival.FleetArrivalAnchorEvent): FleetData.FleetPlayerData | null
    {
        return null;
    }
}
