import * as PlayerDataType from "@/lib/playerData/playerDataTypes";
import * as ServerDataType from "@/lib/serverData/serverDataTypes";
import * as ApplyProgress from "@/lib/gameplay/progressUpdate/applyProgress"
import * as BuildingUpgrade from "@/lib/gameplay/progressUpdate/anchorEvent/buildingUpgradeAnchorEvent"
import * as ShipConstruction from "@/lib/gameplay/progressUpdate/anchorEvent/shipConstructionBatchAnchorEvent"

export const AnchorEventType =
{
    BuildingUpgrade: 1,
    ShipConstructionBatch: 2,
} as const;
export type AnchorEventType = typeof AnchorEventType[keyof typeof AnchorEventType];

export type AnchorEvent =
{
    type: AnchorEventType,
    time: number,
}

export abstract class ProgressResolver
{
    resolveAnchorEvent(playerData: PlayerDataType.PlayerData, serverData: ServerDataType.ServerData, anchorEvent: AnchorEvent): void
    {
        switch (anchorEvent.type)
        {
            case AnchorEventType.BuildingUpgrade:
            {
                BuildingUpgrade.resolveAnchorEvent(playerData, serverData, anchorEvent);
                break;
            }
            case AnchorEventType.ShipConstructionBatch:
            {
                ShipConstruction.resolveAnchorEvent(playerData, serverData, anchorEvent);
                break;
            }
            default:
                throw new Error(`UNREACHABLE: Missing clientProgess AnchorEventType case: ${anchorEvent.type}`);
        }
    }

    updateResourcesToTime(playerData: PlayerDataType.PlayerData, serverData: ServerDataType.ServerData, time: number): void
    {
        ApplyProgress.updateResourcesToTime(playerData, serverData, time);
    }
}