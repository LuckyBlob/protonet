import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as ApplyProgress from "@/lib/gameplay/progressUpdate/applyProgress"
import * as BuildingUpgrade from "@/lib/gameplay/progressUpdate/anchorEvent/buildingUpgradeAnchorEvent"
import * as ShipConstruction from "@/lib/gameplay/progressUpdate/anchorEvent/shipConstructionAnchorEvent"
import * as FleetArrival from "@/lib/gameplay/progressUpdate/anchorEvent/fleetArrivalAnchorEvent"

export const AnchorEventType =
{
    BuildingUpgrade: 1,
    ShipConstruction: 2,
    FleetDeparture: 3,
    FleetArrival: 4,
    CurrentlyResearching: 5,
} as const;
export type AnchorEventType = typeof AnchorEventType[keyof typeof AnchorEventType];

export type AnchorEvent =
{
    type: AnchorEventType,
    time: number,
    resolver: ApplyProgress.PlayerProgressApplier,
}

export function findNextAnchorEvent<T>(playerData: CoreType.PlayerData, playerProgressApplier: ApplyProgress.PlayerProgressApplier, getItems: (planet: CoreType.PlanetData) => T[], getTime: (item: T) => number | null, buildEvent: (item: T, time: number, playerProgressApplier: ApplyProgress.PlayerProgressApplier) => AnchorEvent): AnchorEvent | null
{
    let nextTime: number | null = null;
    let bestItem: T | null = null;

    for (const planetData of playerData.planetDatas)
    {
        for (const item of getItems(planetData))
        {
            const time: number | null = getTime(item);

            if (time === null)
            {
                continue;
            }

            if (nextTime === null || time < nextTime)
            {
                nextTime = time;
                bestItem = item;
            }
        }
    }

    if (nextTime === null || bestItem === null)
    {
        return null;
    }

    return buildEvent(bestItem, nextTime, playerProgressApplier);
}