import * as AnchorEvent from "@/lib/gameplay/progressUpdate/anchorEvent"
import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as ResourceData from "@/lib/gameplay/dynamicData/planet/resourceData";
import * as BuildingData from "@/lib/gameplay/dynamicData/planet/buildingData";
import * as BuildingUpgrade from "@/lib/gameplay/progressUpdate/anchorEvent/buildingUpgradeAnchorEvent"
import * as ShipConstruction from "@/lib/gameplay/progressUpdate/anchorEvent/shipConstructionAnchorEvent"
import * as FleetArrival from "@/lib/gameplay/progressUpdate/anchorEvent/fleetArrivalAnchorEvent"
import * as CurrentlyResearching from "@/lib/gameplay/progressUpdate/anchorEvent/currentlyResearchingAnchorEvent"
import * as FleetData from "@/lib/gameplay/dynamicData/planet/fleet/fleetData";
import * as CalculatedValueData from "@/lib/gameplay/dynamicData/calculatedValueData";
import * as StaticData from "@/lib/gameplay/coreData/static/staticData";
import * as GameType from "@/lib/gameplay/coreData/type/gameTypes"

export abstract class PlayerProgressApplier
{
    abstract applyPlayerProgressAtTime(sourcePlayerData: CoreType.PlayerData, serverData: CoreType.ServerData, targetPlayerId: number, time: number): CoreType.PlayerData | null;

    getNextAnchorEvent(playerData: CoreType.PlayerData): AnchorEvent.AnchorEvent | null
    {
        const anchorEvents: (AnchorEvent.AnchorEvent | null)[] = [];
        anchorEvents.push(BuildingUpgrade.findNextAnchorEvent(playerData, this));
        anchorEvents.push(ShipConstruction.findNextAnchorEvent(playerData, this));
        anchorEvents.push(FleetArrival.findNextAnchorEvent(playerData, this));
        anchorEvents.push(CurrentlyResearching.findNextAnchorEvent(playerData, this));
        
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

    // Keep server data param here even if unused for future ease when we will use it
    resolveAnchorEvent(playerData: CoreType.PlayerData, serverData: CoreType.ServerData, anchorEvent: AnchorEvent.AnchorEvent): void
    {
        switch (anchorEvent.type)
        {
            case AnchorEvent.AnchorEventType.BuildingUpgrade:
            {
                BuildingUpgrade.resolveAnchorEvent(playerData, serverData, anchorEvent);
                break;
            }
            case AnchorEvent.AnchorEventType.ShipConstruction:
            {
                ShipConstruction.resolveAnchorEvent(playerData, serverData, anchorEvent);
                break;
            }
            case AnchorEvent.AnchorEventType.FleetArrival:
            {
                FleetArrival.resolveAnchorEvent(playerData, serverData, anchorEvent);
                break;
            }
            case AnchorEvent.AnchorEventType.CurrentlyResearching:
            {
                CurrentlyResearching.resolveAnchorEvent(playerData, serverData, anchorEvent);
                break;
            }
            default:
                throw new Error(`UNREACHABLE: Missing clientProgess AnchorEventType case: ${anchorEvent.type}`);
        }
    }

    updateResourcesToTime(playerData: CoreType.PlayerData, serverData: CoreType.ServerData, time: number): void
    {
        updateResourcesToTime(playerData, serverData, time);
    }

    abstract getFleetPlayerData(playerId: number | null, planetId: number | null, playerData: CoreType.PlayerData, anchorEvent: FleetArrival.FleetArrivalAnchorEvent) : FleetData.FleetPlayerData | null;

    createFleetActionResolver(): FleetData.FleetActionResolver
    {
        return new FleetData.FleetActionResolver();
    }
}

export function applyProgressToPlayerData(playerData: CoreType.PlayerData, serverData: CoreType.ServerData, now: number, playerProgressResolver: PlayerProgressApplier): CoreType.PlayerData
{
    const modifiedPlayerData: CoreType.PlayerData = structuredClone(playerData);

    let nextAnchorEvent: AnchorEvent.AnchorEvent | null = playerProgressResolver.getNextAnchorEvent(modifiedPlayerData);
    while (nextAnchorEvent !== null && nextAnchorEvent.time < now)
    {
        playerProgressResolver.updateResourcesToTime(modifiedPlayerData, serverData, nextAnchorEvent.time);
        playerProgressResolver.resolveAnchorEvent(modifiedPlayerData, serverData, nextAnchorEvent);
        setUpdatedTimeStamp(modifiedPlayerData, serverData, nextAnchorEvent.time);
        
        nextAnchorEvent = playerProgressResolver.getNextAnchorEvent(modifiedPlayerData);
    }

    playerProgressResolver.updateResourcesToTime(modifiedPlayerData, serverData, now);
    setUpdatedTimeStamp(modifiedPlayerData, serverData, now);

    return modifiedPlayerData;
}

export function updateResourcesToTime(playerData: CoreType.PlayerData, serverData: CoreType.ServerData, time: number): void
{
    for (const planetData of playerData.planetDatas)
    {
        const resourceQuantities: Map<GameType.ResourceType, number> = getPredictedResourceQuantitiesAtTime(planetData, serverData, time);
        clampResourcesToPossibleMaximums(playerData, planetData, serverData, resourceQuantities);

        ResourceData.setResourceQuantities(planetData, resourceQuantities);
    }
}

// Keep server data param here even if unused for future ease when we will use it
function setUpdatedTimeStamp(playerData: CoreType.PlayerData, serverData: CoreType.ServerData, time: number): void
{
    const newPlayerTime: number = Math.max(playerData.playerRow.last_updated, time);
    playerData.playerRow.last_updated = newPlayerTime;
    for (const planetData of playerData.planetDatas)
    {
        planetData.planetRow.last_updated = time;
    }
}

function clampResourcesToPossibleMaximums(playerData: CoreType.PlayerData, planetData: CoreType.PlanetData, serverData: CoreType.ServerData, potentialResourceQuantities: Map<GameType.ResourceType, number>): void
{
    const resourceMaximums: Map<GameType.ResourceType, number> = CalculatedValueData.computeResourceMaximums(planetData);

    for (const [resourceType, potentialResourceQuantity] of potentialResourceQuantities)
    {
        const resourceMaximum: number | undefined = resourceMaximums.get(resourceType);
        if (resourceMaximum === undefined)
        {
            continue;
        }

        const currentResourceQuantity: number = ResourceData.getResourceQuantity(planetData, resourceType);
        if (currentResourceQuantity >= resourceMaximum)
        {
            // If we're already over, we stay there. Maximums only apply to production, but we can receive more by fleets and stay above.
            potentialResourceQuantities.set(resourceType, currentResourceQuantity);
            continue;
        }

        if (potentialResourceQuantity >= resourceMaximum)
        {
            // If we'd go over, cap it.
            potentialResourceQuantities.set(resourceType, resourceMaximum);
            continue;
        }
    }
}

function getPredictedResourceQuantitiesAtTime(planetData: CoreType.PlanetData, serverData: CoreType.ServerData, time: number): Map<GameType.ResourceType, number>
{
    const predictedResourceQuantities: Map<GameType.ResourceType, number> = new Map<GameType.ResourceType, number>();
    for (const resourceType of StaticData.RESOURCE_INFOS.keys())
    {
        predictedResourceQuantities.set(resourceType, getPredictedResourceQuantityAtTime(planetData, serverData, time, resourceType))
    }

    return predictedResourceQuantities;
}

function getPredictedResourceQuantityAtTime(planetData: CoreType.PlanetData, serverData: CoreType.ServerData, time: number, resourceType: GameType.ResourceType): number
{
    const currentResourceQuantity: number = ResourceData.getResourceQuantity(planetData, resourceType);
    const elapsedMilliseconds: number = time - planetData.planetRow.last_updated;
    const elapsedSeconds: number = elapsedMilliseconds / 1000;
    if (elapsedSeconds <= 0)
    {
        return currentResourceQuantity;
    }

    const productionRate: number = BuildingData.getPlanetProductionRatePerSecond(planetData, resourceType, serverData);
    const resourceGained: number = productionRate * elapsedSeconds;

    const updatedResourceQuantity: number = currentResourceQuantity + resourceGained;

    return updatedResourceQuantity;
}