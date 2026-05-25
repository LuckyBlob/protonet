import * as ApplyProgress from "@/lib/gameplay/progressUpdate/applyProgress"

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