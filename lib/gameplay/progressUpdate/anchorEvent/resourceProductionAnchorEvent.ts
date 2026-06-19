import * as AnchorEvent from "@/lib/gameplay/progressUpdate/anchorEvent"
import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as BuildingData from "@/lib/gameplay/dynamicData/planet/buildingData";
import * as ApplyProgress from "@/lib/gameplay/progressUpdate/applyProgress"
import * as StaticDataHelper from "@/lib/gameplay/coreData/static/staticDataHelpers";
import * as ThingType from "@/lib/gameplay/coreData/thing/thingTypes";
import * as ResourceData from "@/lib/gameplay/dynamicData/planet/resourceData";

type ResourceProduction =
{
    planetId: number,
    resourceType: GameType.ResourceType,
    startingValue: number,
    productionPerSecond: number,
}

export type ResourceProductionAnchorEvent = AnchorEvent.AnchorEvent &
{
    planetId: number,
    resourceType: GameType.ResourceType,
}

export function findNextAnchorEvent(playerData: CoreType.PlayerData, serverData: CoreType.ServerData, playerProgressApplier: ApplyProgress.PlayerProgressApplier): AnchorEvent.AnchorEvent | null
{
    const getItems = (planetData: CoreType.PlanetData): ResourceProduction[] =>
    {
        const resourceProductionItems: ResourceProduction[] = [];

        const resourceTypes: GameType.ResourceType[] = StaticDataHelper.getAllSpecificThings(ThingType.Thing.Resource);
        for (const resourceType of resourceTypes)
        {
            const productionRatePerSecond: number = BuildingData.getPlanetProductionRatePerSecond(planetData, resourceType, serverData, playerData);
            if (productionRatePerSecond >= 0)
            {
                continue;
            }

            const newResourceProductionItem: ResourceProduction =
            {
                planetId: planetData.planetRow.id,
                resourceType: resourceType,
                startingValue: ResourceData.getResourceQuantity(planetData, resourceType),
                productionPerSecond: productionRatePerSecond,
            }
            resourceProductionItems.push(newResourceProductionItem);
        }

        return resourceProductionItems;
    };
    const getTime = (item: ResourceProduction, startTime: number): number =>
    {
        return startTime + Math.abs(item.startingValue / item.productionPerSecond) * 1000;
    };
    const buildEvent = (item: ResourceProduction, time: number, playerProgressApplier: ApplyProgress.PlayerProgressApplier): AnchorEvent.AnchorEvent =>
    {
        const newEvent: ResourceProductionAnchorEvent =
        {
            type: AnchorEvent.AnchorEventType.ResourceProduction,
            time: time,
            resolver: playerProgressApplier,
            resourceType: item.resourceType,
            planetId: item.planetId,
        };

        return newEvent;
    };

    return AnchorEvent.findNextAnchorEvent(playerData, playerProgressApplier, getItems, getTime, buildEvent);
}

export function resolveAnchorEvent(playerData: CoreType.PlayerData, serverData: CoreType.ServerData, anchorEvent: AnchorEvent.AnchorEvent): void
{
    const resourceProductionAnchorEvent: ResourceProductionAnchorEvent = anchorEvent as ResourceProductionAnchorEvent;
    const planetData: CoreType.PlanetData | null = CoreType.getPlanetDataForId(playerData.planetDatas, resourceProductionAnchorEvent.planetId);
    if (planetData === null)
    {
        console.error("⚠️:", `Detected resource production anchor event but had no planetData for planet id.`);
        return;
    }

    BuildingData.setConsumingBuildingsEnergyToZero(planetData, resourceProductionAnchorEvent.resourceType);
}
