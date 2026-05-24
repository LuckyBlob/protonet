import * as PlayerDataType from "@/lib/gameplay/gameplayData/player/playerDataTypes";
import * as ServerDataType from "@/lib/gameplay/gameplayData/server/serverDataTypes";
import * as ApplyProgress from "@/lib/gameplay/progressUpdate/applyProgress"
import * as BuildingUpgrade from "@/lib/gameplay/progressUpdate/anchorEvent/buildingUpgradeAnchorEvent"
import * as ShipConstruction from "@/lib/gameplay/progressUpdate/anchorEvent/shipConstructionBatchAnchorEvent"
import * as FleetArrival from "@/lib/gameplay/progressUpdate/anchorEvent/fleetArrivalAnchorEvent"

export const AnchorEventType =
{
    BuildingUpgrade: 1,
    ShipConstructionBatch: 2,
    FleetDeparture: 3,
    FleetArrival: 4,
} as const;
export type AnchorEventType = typeof AnchorEventType[keyof typeof AnchorEventType];

export type AnchorEvent =
{
    type: AnchorEventType,
    time: number,
    resolver?: ApplyProgress.PlayerProgressApplier,
}