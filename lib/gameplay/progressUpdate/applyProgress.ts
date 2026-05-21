import * as AnchorEvent from "@/lib/gameplay/progressUpdate/anchorEvent"
import * as PlayerDataType from "@/lib/gameplay/gameplayData/player/playerDataTypes";
import * as ServerDataType from "@/lib/gameplay/gameplayData/server/serverDataTypes";
import * as ResourceData from "@/lib/gameplay/gameplayData/dynamic/resourceData";
import * as Production from "@/lib/gameplay/production";
import * as ThingTypes from "@/lib/gameplay/coreData/type/thingTypes";
import * as BuildingUpgrade from "@/lib/gameplay/progressUpdate/anchorEvent/buildingUpgradeAnchorEvent"
import * as ShipConstruction from "@/lib/gameplay/progressUpdate/anchorEvent/shipConstructionBatchAnchorEvent"

export function applyProgressToPlayerData(playerData: PlayerDataType.PlayerData, serverData: ServerDataType.ServerData, now: number, progressResolver: AnchorEvent.ProgressResolver): PlayerDataType.PlayerData
{
    const modifiedPlayerData: PlayerDataType.PlayerData = structuredClone(playerData);

    let nextAnchorEvent: AnchorEvent.AnchorEvent | null = getNextAnchorEvent(modifiedPlayerData);
    while (nextAnchorEvent !== null && nextAnchorEvent.time < now)
    {
        progressResolver.updateResourcesToTime(modifiedPlayerData, serverData, nextAnchorEvent.time);
        progressResolver.resolveAnchorEvent(modifiedPlayerData, serverData, nextAnchorEvent);
        setUpdatedTimeStamp(modifiedPlayerData, serverData, nextAnchorEvent.time);
        
        nextAnchorEvent = getNextAnchorEvent(modifiedPlayerData);
    }

    progressResolver.updateResourcesToTime(modifiedPlayerData, serverData, now);
    setUpdatedTimeStamp(modifiedPlayerData, serverData, now);

    return modifiedPlayerData;
}

export function updateResourcesToTime(playerData: PlayerDataType.PlayerData, serverData: ServerDataType.ServerData, time: number): void
{
    for (const fullPlanetData of playerData.fullPlanetDatas)
    {
        applyUpdateAtTimeForPlanet(fullPlanetData, serverData, time);
    }
}

function setUpdatedTimeStamp(playerData: PlayerDataType.PlayerData, serverData: ServerDataType.ServerData, time: number)
{
    playerData.playerRow.last_updated = time;
    for (const fullPlanetData of playerData.fullPlanetDatas)
    {
        fullPlanetData.planetRow.last_updated = time;
    }
}

function applyUpdateAtTimeForPlanet(fullPlanetData: PlayerDataType.FullPlanetData, serverData: ServerDataType.ServerData, time: number): void
{
    const resourceQuantities: Map<number, number> = getPredictedResourceQuantitiesAtTime(fullPlanetData, serverData, time);

    ResourceData.setResourceQuantities(fullPlanetData, resourceQuantities);
}

function getPredictedResourceQuantitiesAtTime(fullPlanetData: PlayerDataType.FullPlanetData, serverData: ServerDataType.ServerData, time: number): Map<number, number>
{
    const resourceTypes: number[] = ThingTypes.getAllSpecificThings(ThingTypes.Thing.Resource);

    const predictedResourceQuantities: Map<number, number> = new Map<number, number>();
    for (const resourceType of resourceTypes)
    {
        predictedResourceQuantities.set(resourceType, getPredictedResourceQuantityAtTime(fullPlanetData, serverData, time, resourceType))
    }

    return predictedResourceQuantities;
}

function getPredictedResourceQuantityAtTime(fullPlanetData: PlayerDataType.FullPlanetData, serverData: ServerDataType.ServerData, time: number, resourceType: number): number
{
    const currentResourceQuantity: number = ResourceData.getResourceQuantity(fullPlanetData, resourceType);
    const elapsedMilliseconds: number = time - fullPlanetData.planetRow.last_updated;
    const elapsedSeconds: number = elapsedMilliseconds / 1000;
    if (elapsedSeconds <= 0)
    {
        return currentResourceQuantity;
    }

    const productionRate: number = Production.getPlanetProductionRatePerSecond(fullPlanetData, resourceType, serverData);
    const resourceGained: number = productionRate * elapsedSeconds;

    const updatedResourceQuantity: number = currentResourceQuantity + resourceGained;

    return updatedResourceQuantity;
}

function getNextAnchorEvent(playerData: PlayerDataType.PlayerData): AnchorEvent.AnchorEvent | null
{
    const anchorEvents: (AnchorEvent.AnchorEvent | null)[] = [];
    anchorEvents.push(BuildingUpgrade.findNextAnchorEvent(playerData));
    anchorEvents.push(ShipConstruction.findNextAnchorEvent(playerData));
    
    let nextAnchorEvent: AnchorEvent.AnchorEvent | null = null;
    for (const anchorEvent of anchorEvents)
    {
        if (anchorEvent === null)
        {
            continue;
        }

        if (nextAnchorEvent === null || nextAnchorEvent.time > anchorEvent.time)
        {
            nextAnchorEvent = anchorEvent;
        }
    }

    return nextAnchorEvent;
}