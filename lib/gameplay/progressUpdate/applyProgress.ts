import * as AnchorEvent from "@/lib/gameplay/progressUpdate/anchorEvent"
import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as ResourceData from "@/lib/gameplay/dynamicData/planet/resourceData";
import * as BuildingData from "@/lib/gameplay/dynamicData/planet/buildingData";
import * as BuildingUpgrade from "@/lib/gameplay/progressUpdate/anchorEvent/buildingUpgradeAnchorEvent"
import * as BuildingDeconstruction from "@/lib/gameplay/progressUpdate/anchorEvent/buildingDeconstructionAnchorEvent"
import * as UnitConstruction from "@/lib/gameplay/progressUpdate/anchorEvent/unitConstructionAnchorEvent"
import * as FleetArrival from "@/lib/gameplay/progressUpdate/anchorEvent/fleetArrivalAnchorEvent"
import * as CurrentlyResearching from "@/lib/gameplay/progressUpdate/anchorEvent/currentlyResearchingAnchorEvent"
import * as ResourceProduction from "@/lib/gameplay/progressUpdate/anchorEvent/resourceProductionAnchorEvent"
import * as RepairAnchor from "@/lib/gameplay/progressUpdate/anchorEvent/repairAnchorEvent"
import * as FleetData from "@/lib/gameplay/dynamicData/planet/fleet/fleetData";
import * as CalculatedValueData from "@/lib/gameplay/dynamicData/calculatedValueData";
import * as StaticData from "@/lib/gameplay/coreData/static/staticData";
import * as GameType from "@/lib/gameplay/coreData/type/gameTypes"

export abstract class PlayerProgressApplier
{
    abstract applyPlayerProgressAtTime(sourcePlayerData: CoreType.PlayerData, serverData: CoreType.ServerData, targetPlayerId: number, time: number): CoreType.PlayerData | null;

    getNextAnchorEvent(playerData: CoreType.PlayerData, serverData: CoreType.ServerData): AnchorEvent.AnchorEvent | null
    {
        const anchorEvents: (AnchorEvent.AnchorEvent | null)[] = [];
        anchorEvents.push(BuildingUpgrade.findNextAnchorEvent(playerData, serverData, this));
        anchorEvents.push(BuildingDeconstruction.findNextAnchorEvent(playerData, serverData, this));
        anchorEvents.push(UnitConstruction.findNextAnchorEvent(playerData, serverData, this));
        anchorEvents.push(FleetArrival.findNextAnchorEvent(playerData, serverData, this));
        anchorEvents.push(CurrentlyResearching.findNextAnchorEvent(playerData, serverData, this));
        anchorEvents.push(ResourceProduction.findNextAnchorEvent(playerData, serverData, this));
        anchorEvents.push(RepairAnchor.findNextAnchorEvent(playerData, serverData, this));

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
            case AnchorEvent.AnchorEventType.BuildingDeconstruction:
            {
                BuildingDeconstruction.resolveAnchorEvent(playerData, serverData, anchorEvent);
                break;
            }
            case AnchorEvent.AnchorEventType.UnitConstruction:
            {
                UnitConstruction.resolveAnchorEvent(playerData, serverData, anchorEvent);
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
            case AnchorEvent.AnchorEventType.ResourceProduction:
            {
                ResourceProduction.resolveAnchorEvent(playerData, serverData, anchorEvent);
                break;
            }
            case AnchorEvent.AnchorEventType.Repair:
            {
                RepairAnchor.resolveAnchorEvent(playerData, serverData, anchorEvent);
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

    abstract getFleetPlayerData(playerId: number | null, address: GameType.PlanetAddress | null, playerData: CoreType.PlayerData, anchorEvent: FleetArrival.FleetArrivalAnchorEvent) : FleetData.FleetPlayerData | null;
}

export function applyProgressToPlayerData(playerData: CoreType.PlayerData, serverData: CoreType.ServerData, now: number, playerProgressResolver: PlayerProgressApplier): CoreType.PlayerData
{
    const modifiedPlayerData: CoreType.PlayerData = structuredClone(playerData);

    let nextAnchorEvent: AnchorEvent.AnchorEvent | null = playerProgressResolver.getNextAnchorEvent(modifiedPlayerData, serverData);
    while (nextAnchorEvent !== null && nextAnchorEvent.time < now)
    {
        playerProgressResolver.updateResourcesToTime(modifiedPlayerData, serverData, nextAnchorEvent.time);
        playerProgressResolver.resolveAnchorEvent(modifiedPlayerData, serverData, nextAnchorEvent);
        setUpdatedTimeStamp(modifiedPlayerData, serverData, nextAnchorEvent.time);
        
        nextAnchorEvent = playerProgressResolver.getNextAnchorEvent(modifiedPlayerData, serverData);
    }

    playerProgressResolver.updateResourcesToTime(modifiedPlayerData, serverData, now);
    setUpdatedTimeStamp(modifiedPlayerData, serverData, now);

    return modifiedPlayerData;
}

export function updateResourcesToTime(playerData: CoreType.PlayerData, serverData: CoreType.ServerData, time: number): void
{
    // playerData is threaded into the per-planet production and maximum computations so energy-tech-scaled
    // planet values (the Fusion Reactor) can read the owning player's research levels.
    for (const planetData of playerData.planetDatas)
    {
        const resourceQuantities: Map<GameType.ResourceType, number> = getPredictedResourceQuantitiesAtTime(planetData, serverData, time, playerData);
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
    const resourceMaximums: Map<GameType.ResourceType, number> = CalculatedValueData.computeResourceMaximums(planetData, playerData);

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
            potentialResourceQuantities.set(resourceType, resourceMaximum);
            continue;
        }
    }
}

function getPredictedResourceQuantitiesAtTime(planetData: CoreType.PlanetData, serverData: CoreType.ServerData, time: number, playerData: CoreType.PlayerData): Map<GameType.ResourceType, number>
{
    const predictedResourceQuantities: Map<GameType.ResourceType, number> = new Map<GameType.ResourceType, number>();
    for (const resourceType of StaticData.RESOURCE_INFOS.keys())
    {
        predictedResourceQuantities.set(resourceType, getPredictedResourceQuantityAtTime(planetData, serverData, time, resourceType, playerData))
    }

    return predictedResourceQuantities;
}

function getPredictedResourceQuantityAtTime(planetData: CoreType.PlanetData, serverData: CoreType.ServerData, time: number, resourceType: GameType.ResourceType, playerData: CoreType.PlayerData): number
{
    const currentResourceQuantity: number = ResourceData.getResourceQuantity(planetData, resourceType);
    const elapsedMilliseconds: number = time - planetData.planetRow.last_updated;
    const elapsedSeconds: number = elapsedMilliseconds / 1000;
    if (elapsedSeconds <= 0)
    {
        return currentResourceQuantity;
    }

    const productionRate: number = BuildingData.getPlanetProductionRatePerSecond(planetData, resourceType, serverData, playerData);
    const resourceGained: number = productionRate * elapsedSeconds;

    // resourceGained can be negative when a building drains the resource (e.g. the Fusion Reactor
    // burning deuterium), so floor at 0 — a planet can never hold a negative quantity.
    const updatedResourceQuantity: number = Math.max(0, currentResourceQuantity + resourceGained);

    return updatedResourceQuantity;
}