import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as BuildingData from "@/lib/gameplay/dynamicData/planet/buildingData";
import * as RequirementType from "@/lib/gameplay/coreData/requirement/requirementTypes";
import * as BuildingUpgradeData from "@/lib/gameplay/dynamicData/planet/buildingUpgradeData";
import * as ResearchData from "@/lib/gameplay/dynamicData/player/researchData";
import * as CalculatedValueData from "@/lib/gameplay/dynamicData/calculatedValueData";
import * as StaticDataHelper from "@/lib/gameplay/coreData/static/staticDataHelpers";

function getPlanetData(playerData: CoreType.PlayerData, planetId: number): CoreType.PlanetData
{
    const planetData: CoreType.PlanetData | null = CoreType.getPlanetDataForId(playerData.planetDatas, planetId);
    if (planetData === null)
    {
        throw new Error(`No PlanetData for planetId ${planetId}`);
    }
    return planetData;
}

export function isAnyBuildingUpgradeInProgress(): RequirementType.ThingValueGetter
{
    return (context: RequirementType.RequirementContext): number =>
    {
        const planetData: CoreType.PlanetData = getPlanetData(context.playerData, context.planetId);
        return planetData.dynamicPlanetData.buildingUpgrades.length > 0 ? 1 : 0;
    };
}

export function isAnyResearchInProgress(): RequirementType.ThingValueGetter
{
    return (context: RequirementType.RequirementContext): number =>
    {
        // Research is player-level, so it reads playerData directly rather than a planet.
        return context.playerData.dynamicPlayerData.currentlyResearchings.length > 0 ? 1 : 0;
    };
}

export function buildingLevel(buildingType: GameType.BuildingType): RequirementType.SpecificThingValueGetter
{
    return (context: RequirementType.RequirementContext): number =>
    {
        const planetData: CoreType.PlanetData = getPlanetData(context.playerData, context.planetId);
        return BuildingData.getBuildingLevel(planetData, buildingType);
    };
}

export function researchLevel(researchType: GameType.ResearchType): RequirementType.SpecificThingValueGetter
{
    return (context: RequirementType.RequirementContext): number =>
    {
        return ResearchData.getResearchLevel(context.playerData, researchType);
    };
}

export function isSpecificBuildingBeingUpgraded(buildingType: GameType.BuildingType): RequirementType.SpecificThingValueGetter
{
    return (context: RequirementType.RequirementContext): number =>
    {
        const planetData: CoreType.PlanetData = getPlanetData(context.playerData, context.planetId);
        ;
        const isUpgrading: boolean = BuildingUpgradeData.isBuildingTypeCurrentlyUpgrading(planetData, buildingType);
        return isUpgrading ? 1 : 0;
    };
}

export function shipQuantities(shipType: GameType.ShipType): RequirementType.ThingValueGetter
{
    return (context: RequirementType.RequirementContext): number =>
    {
        if (context.shipQuantities === undefined)
        {
            throw new Error(`shipQuantities requirement evaluated without a potential fleet action for shipType ${shipType}.`);
        }

        return context.shipQuantities.get(shipType) ?? 0;
    };
}

export function playerPlanetCount(): RequirementType.ThingValueGetter
{
    return (context: RequirementType.RequirementContext): number =>
    {
        return CoreType.getOwnedPlanets(context.playerData.planetDatas).length;
    };
}

export function hasFreeFleetSlot(): RequirementType.ThingValueGetter
{
    return (context: RequirementType.RequirementContext): number =>
    {
        // The fleet slot cap is a derived player value (Computer Technology produces it, one per level on
        // top of the base slot). Read the net (production minus consumption) so future consumers can spend slots.
        const fleetSlotsValueData: CoreType.CalculatedValueData | null = CalculatedValueData.computePlayerValueData(context.playerData, GameType.PlayerValueType.FleetSlots);
        const maximumFleetSlots: number = fleetSlotsValueData === null ? 0 : fleetSlotsValueData.production - fleetSlotsValueData.consumption;

        // A fleet occupies a slot for its whole round trip. The player's own movements appear in the
        // futureFleetArrivals of every planet they touch, so collapse them to distinct fleet ids.
        const activeFleetIds: Set<number> = new Set<number>();
        for (const planetData of context.playerData.planetDatas)
        {
            for (const fleetMovement of planetData.dynamicPlanetData.futureFleetArrivals)
            {
                if (fleetMovement.fleetMovementRow.player_origin_id === context.playerData.playerRow.id)
                {
                    activeFleetIds.add(fleetMovement.fleetMovementRow.id);
                }
            }
        }

        return activeFleetIds.size < maximumFleetSlots ? 1 : 0;
    };
}

export function isTargetPlanetOwned(): RequirementType.ThingValueGetter
{
    return (context: RequirementType.RequirementContext): number =>
    {
        if (context.targetPlanetOwnerPlayerId === undefined)
        {
            throw new Error(`isTargetPlanetOwned requirement evaluated without target planet ownership info.`);
        }

        return context.targetPlanetOwnerPlayerId === null ? 0 : 1;
    };
}

export function getTargetPlanetZone(): RequirementType.ThingValueGetter
{
    return (context: RequirementType.RequirementContext): number =>
    {
        if (context.targetPlanetAddress === undefined)
        {
            throw new Error(`getTargetPlanetZone requirement evaluated without a target planet address.`);
        }

        return context.targetPlanetAddress.zone;
    };
}

export function doesTargetZoneExist(): RequirementType.ThingValueGetter
{
    return (context: RequirementType.RequirementContext): number =>
    {
        if (context.targetZoneExists === undefined)
        {
            throw new Error(`doesTargetZoneExist requirement evaluated without target zone existence info.`);
        }

        return context.targetZoneExists === true ? 1 : 0;
    };
}

export function allFleetShipsCanTargetDebrisField(): RequirementType.ThingValueGetter
{
    return (context: RequirementType.RequirementContext): number =>
    {
        if (context.shipQuantities === undefined)
        {
            throw new Error(`allFleetShipsCanTargetDebrisField requirement evaluated without a potential fleet action.`);
        }

        for (const [shipType, shipQuantity] of context.shipQuantities)
        {
            if (shipQuantity <= 0)
            {
                continue;
            }

            if (StaticDataHelper.canShipTargetDebrisField(shipType) === false)
            {
                return 0;
            }
        }

        return 1;
    };
}