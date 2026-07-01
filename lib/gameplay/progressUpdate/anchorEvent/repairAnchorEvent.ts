import * as AnchorEvent from "@/lib/gameplay/progressUpdate/anchorEvent"
import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as UnitData from "@/lib/gameplay/dynamicData/planet/unitData";
import * as PendingRepairData from "@/lib/gameplay/dynamicData/planet/pendingRepairData";
import * as ApplyProgress from "@/lib/gameplay/progressUpdate/applyProgress"

export type RepairAnchorEvent = AnchorEvent.AnchorEvent &
{
    pendingRepair: CoreType.PendingRepair,
}

export function findNextAnchorEvent(playerData: CoreType.PlayerData, serverData: CoreType.ServerData, playerProgressApplier: ApplyProgress.PlayerProgressApplier): AnchorEvent.AnchorEvent | null
{
    const getItems = (planet: CoreType.PlanetData): CoreType.PendingRepair[] =>
    {
        return planet.dynamicPlanetData.pendingRepairs;
    };

    const burnUpAnchorEvent: AnchorEvent.AnchorEvent | null = AnchorEvent.findNextAnchorEvent(
        playerData,
        playerProgressApplier,
        getItems,
        (item: CoreType.PendingRepair): number | null => PendingRepairData.getBurnUpTime(item),
        buildRepairAnchorEvent
    );

    const autoCollectAnchorEvent: AnchorEvent.AnchorEvent | null = AnchorEvent.findNextAnchorEvent(
        playerData,
        playerProgressApplier,
        getItems,
        (item: CoreType.PendingRepair): number | null => PendingRepairData.getAutoCollectTime(item),
        buildRepairAnchorEvent
    );

    return getEarlierAnchorEvent(burnUpAnchorEvent, autoCollectAnchorEvent);
}

function getEarlierAnchorEvent(firstAnchorEvent: AnchorEvent.AnchorEvent | null, secondAnchorEvent: AnchorEvent.AnchorEvent | null): AnchorEvent.AnchorEvent | null
{
    if (firstAnchorEvent === null)
    {
        return secondAnchorEvent;
    }

    if (secondAnchorEvent === null)
    {
        return firstAnchorEvent;
    }

    return firstAnchorEvent.time <= secondAnchorEvent.time ? firstAnchorEvent : secondAnchorEvent;
}

function buildRepairAnchorEvent(pendingRepair: CoreType.PendingRepair, time: number, playerProgressApplier: ApplyProgress.PlayerProgressApplier): AnchorEvent.AnchorEvent
{
    const repairAnchorEvent: RepairAnchorEvent =
    {
        type: AnchorEvent.AnchorEventType.Repair,
        time: time,
        pendingRepair: pendingRepair,
        resolver: playerProgressApplier,
    };

    return repairAnchorEvent;
}

export function resolveAnchorEvent(playerData: CoreType.PlayerData, serverData: CoreType.ServerData, anchorEvent: AnchorEvent.AnchorEvent): void
{
    const repairAnchorEvent: RepairAnchorEvent = anchorEvent as RepairAnchorEvent;
    const planetData: CoreType.PlanetData | null = CoreType.getPlanetDataForId(playerData.planetDatas, repairAnchorEvent.pendingRepair.pendingRepairRow.planet_id);
    if (planetData === null)
    {
        console.error("⚠️:", `Detected repair anchor event but had no planetData for planet id ${repairAnchorEvent.pendingRepair.pendingRepairRow.planet_id}.`);
        return;
    }

    const pendingRepairId: number = repairAnchorEvent.pendingRepair.pendingRepairRow.id;

    if (PendingRepairData.isWreckAwaitingRepair(repairAnchorEvent.pendingRepair) === true)
    {
        PendingRepairData.removePendingRepair(planetData, pendingRepairId);
        return;
    }

    const repairedUnitQuantities: Map<GameType.UnitType, number> = PendingRepairData.getPendingRepairUnitQuantities(repairAnchorEvent.pendingRepair);
    UnitData.addPlanetUnits(planetData, repairedUnitQuantities);
    PendingRepairData.removePendingRepair(planetData, pendingRepairId);
}
