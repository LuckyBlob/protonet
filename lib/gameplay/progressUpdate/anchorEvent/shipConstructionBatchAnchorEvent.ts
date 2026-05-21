import * as AnchorEvent from "@/lib/gameplay/progressUpdate/anchorEvent"
import * as PlayerDataType from "@/lib/gameplay/gameplayData/player/playerDataTypes";
import * as ServerDataType from "@/lib/gameplay/gameplayData/server/serverDataTypes";
import * as DBType from "@/lib/db/dbTypes";
import * as ShipData from "@/lib/gameplay/gameplayData/dynamic/shipData";

export type ShipConstructionBatchAnchorEvent = AnchorEvent.AnchorEvent &
{
    fullPlanetDataIndex: number,
}

export function findNextAnchorEvent(playerData: PlayerDataType.PlayerData): AnchorEvent.AnchorEvent | null
{
    let nextTime: number | null = null;
    let nextFullPlanetDataIndex: number | null = null;
    for (let Index = 0; Index < playerData.fullPlanetDatas.length; Index++)
    {
        if (playerData.fullPlanetDatas[Index].planetRow.ship_construction_batch_completes_at === 0)
        {
            continue;
        }

        if (nextTime === null || playerData.fullPlanetDatas[Index].planetRow.ship_construction_batch_completes_at < nextTime)
        {
            nextTime = playerData.fullPlanetDatas[Index].planetRow.ship_construction_batch_completes_at;
            nextFullPlanetDataIndex = Index;
        }
    }

    if (nextTime === null || nextFullPlanetDataIndex === null)
    {
        return null;
    }

    const nextEvent: ShipConstructionBatchAnchorEvent =
    {
        type: AnchorEvent.AnchorEventType.ShipConstructionBatch,
        time: nextTime,
        fullPlanetDataIndex: nextFullPlanetDataIndex,
    };
    return nextEvent;
}

export function resolveAnchorEvent(playerData: PlayerDataType.PlayerData, serverData: ServerDataType.ServerData, anchorEvent: AnchorEvent.AnchorEvent): void
{
    const shipConstructionBatchAnchorEvent: ShipConstructionBatchAnchorEvent = anchorEvent as ShipConstructionBatchAnchorEvent;
    const fullPlanetData: PlayerDataType.FullPlanetData = playerData.fullPlanetDatas[shipConstructionBatchAnchorEvent.fullPlanetDataIndex];
    if (fullPlanetData.dynamicPlanetData.queuedShipConstructionBatchs.length === 0)
    {
        fullPlanetData.planetRow.current_ship_construction_batch_id = 0;
        fullPlanetData.planetRow.ship_construction_batch_completes_at = 0;
        console.warn(`Detected ship construction batch anchor event but had no queuedShipConstructionBatchs for planet id ${fullPlanetData.planetRow.id}`);
        return;
    }

    const finishedBatch: PlayerDataType.ShipConstructionBatch = fullPlanetData.dynamicPlanetData.queuedShipConstructionBatchs[0];
    if (finishedBatch.batchId !== fullPlanetData.planetRow.current_ship_construction_batch_id)
    {
        throw new Error(`UNREACHABLE: Ship construction batch ID missmatch: BatchId ${finishedBatch.batchId} / construction id${fullPlanetData.planetRow.current_ship_construction_batch_id} / planetid ${fullPlanetData.planetRow.id}`);
    }

    for (const shipConstructionRow of finishedBatch.shipConstructionRows)
    {
        const oldShipQuantity: number = ShipData.getShipQuantity(fullPlanetData, shipConstructionRow.ship_type);
        ShipData.setShipQuantity(fullPlanetData, shipConstructionRow.ship_type, oldShipQuantity + shipConstructionRow.ship_quantity);
    }

    fullPlanetData.planetRow.current_ship_construction_batch_id = 0;
    fullPlanetData.planetRow.ship_construction_batch_completes_at = 0;

    fullPlanetData.dynamicPlanetData.queuedShipConstructionBatchs.shift();
    if (fullPlanetData.dynamicPlanetData.queuedShipConstructionBatchs.length !== 0)
    {
        const newBatchTimeSeconds: number = ShipData.computeShipConstructionBatchDurationSeconds(fullPlanetData.dynamicPlanetData.queuedShipConstructionBatchs[0], fullPlanetData, serverData);
        if (newBatchTimeSeconds === 0 || fullPlanetData.dynamicPlanetData.queuedShipConstructionBatchs[0].shipConstructionRows.length === 0)
        {
            throw new Error(`UNREACHABLE: Corrupted ship construction batch: PlanetId ${fullPlanetData.planetRow.id}`);
        }
        fullPlanetData.planetRow.current_ship_construction_batch_id = fullPlanetData.dynamicPlanetData.queuedShipConstructionBatchs[0].batchId;
        const newBatchTimeMilliseconds: number = newBatchTimeSeconds * 1000;
        fullPlanetData.planetRow.ship_construction_batch_completes_at = anchorEvent.time + newBatchTimeMilliseconds ;
    }
}