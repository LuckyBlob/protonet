import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as BuildingData from "@/lib/gameplay/dynamicData/planet/buildingData";
import * as RequirementType from "@/lib/gameplay/coreData/requirement/requirementTypes";
import * as BuildingUpgradeData from "@/lib/gameplay/dynamicData/planet/buildingUpgradeData";
import * as BuildingDeconstructionData from "@/lib/gameplay/dynamicData/planet/buildingDeconstructionData";
import * as ResearchData from "@/lib/gameplay/dynamicData/player/researchData";
import * as CalculatedValueData from "@/lib/gameplay/dynamicData/calculatedValueData";
import * as MissileSpaceData from "@/lib/gameplay/dynamicData/planet/missileSpaceData";
import * as ScoreData from "@/lib/gameplay/dynamicData/player/scoreData";
import * as StaticDataHelper from "@/lib/gameplay/coreData/static/staticDataHelpers";

const SCORE_TARGET_PROTECTION_THRESHOLD: number = 500000;
const MAX_ATTACKER_TO_TARGET_SCORE_RATIO: number = 5;

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

export function isAnyBuildingDeconstructionInProgress(): RequirementType.ThingValueGetter
{
    return (context: RequirementType.RequirementContext): number =>
    {
        const planetData: CoreType.PlanetData = getPlanetData(context.playerData, context.planetId);
        return planetData.dynamicPlanetData.buildingDeconstructions.length > 0 ? 1 : 0;
    };
}

export function isAnyUnitBeingConstructed(): RequirementType.ThingValueGetter
{
    return (context: RequirementType.RequirementContext): number =>
    {
        const planetData: CoreType.PlanetData = getPlanetData(context.playerData, context.planetId);
        return planetData.dynamicPlanetData.unitConstructions.length > 0 ? 1 : 0;
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

export function isSpecificBuildingBeingDeconstructed(buildingType: GameType.BuildingType): RequirementType.SpecificThingValueGetter
{
    return (context: RequirementType.RequirementContext): number =>
    {
        const planetData: CoreType.PlanetData = getPlanetData(context.playerData, context.planetId);
        const isDeconstructing: boolean = BuildingDeconstructionData.isBuildingTypeCurrentlyDeconstructing(planetData, buildingType);
        return isDeconstructing ? 1 : 0;
    };
}

export function unitQuantities(unitType: GameType.UnitType): RequirementType.ThingValueGetter
{
    return (context: RequirementType.RequirementContext): number =>
    {
        if (context.unitQuantities === undefined)
        {
            throw new Error(`unitQuantities requirement evaluated without a potential fleet action for unitType ${unitType}.`);
        }

        return context.unitQuantities.get(unitType) ?? 0;
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

export function freeMissileSpace(): RequirementType.SpecificThingValueGetter
{
    return (context: RequirementType.RequirementContext): number =>
    {
        const planetData: CoreType.PlanetData = getPlanetData(context.playerData, context.planetId);
        return MissileSpaceData.computeFreeMissileSpace(planetData, context.playerData);
    };
}

export function freeSize(): RequirementType.ThingValueGetter
{
    return (context: RequirementType.RequirementContext): number =>
    {
        const planetData: CoreType.PlanetData = getPlanetData(context.playerData, context.planetId);
        const sizeValueData: CoreType.CalculatedValueData | null = CalculatedValueData.computePlanetValueData(planetData, GameType.PlanetValueType.Size, context.playerData);
        if (sizeValueData === null)
        {
            return 0;
        }

        return sizeValueData.production - sizeValueData.consumption;
    };
}

export function isZoneAssociatedPlanetOwned(): RequirementType.ThingValueGetter
{
    return (context: RequirementType.RequirementContext): number =>
    {
        if (context.zoneAssociatedPlanetOwnerPlayerId === undefined)
        {
            throw new Error(`isZoneAssociatedPlanetOwned requirement evaluated without zone-associated planet ownership info.`);
        }

        return context.zoneAssociatedPlanetOwnerPlayerId === null ? 0 : 1;
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

export function isTargetPlanetZoneSpyable(): RequirementType.ThingValueGetter
{
    return (context: RequirementType.RequirementContext): number =>
    {
        if (context.targetPlanetAddress === undefined)
        {
            throw new Error(`isTargetPlanetZoneSpyable requirement evaluated without a target planet address.`);
        }

        return StaticDataHelper.canPlanetZoneBeSpied(context.targetPlanetAddress.zone) === true ? 1 : 0;
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

export function transportedResourceTotal(): RequirementType.ThingValueGetter
{
    return (context: RequirementType.RequirementContext): number =>
    {
        if (context.transportedResourceQuantities === undefined)
        {
            throw new Error(`transportedResourceTotal requirement evaluated without transported resource quantities.`);
        }

        let totalTransportedResources: number = 0;
        for (const [, transportedResourceQuantity] of context.transportedResourceQuantities)
        {
            totalTransportedResources += transportedResourceQuantity;
        }

        return totalTransportedResources;
    };
}

export function allFleetUnitsCanTargetDebrisField(): RequirementType.ThingValueGetter
{
    return (context: RequirementType.RequirementContext): number =>
    {
        if (context.unitQuantities === undefined)
        {
            throw new Error(`allFleetUnitsCanTargetDebrisField requirement evaluated without a potential fleet action.`);
        }

        for (const [unitType, unitQuantity] of context.unitQuantities)
        {
            if (unitQuantity <= 0)
            {
                continue;
            }

            if (StaticDataHelper.canUnitTargetDebrisField(unitType) === false)
            {
                return 0;
            }
        }

        return 1;
    };
}

export function allFleetUnitsCanSpy(): RequirementType.ThingValueGetter
{
    return (context: RequirementType.RequirementContext): number =>
    {
        if (context.unitQuantities === undefined)
        {
            throw new Error(`allFleetUnitsCanSpy requirement evaluated without a potential fleet action.`);
        }

        for (const [unitType, unitQuantity] of context.unitQuantities)
        {
            if (unitQuantity <= 0)
            {
                continue;
            }

            if (StaticDataHelper.canUnitSpy(unitType) === false)
            {
                return 0;
            }
        }

        return 1;
    };
}

export function canTargetPlayerByScore(): RequirementType.ThingValueGetter
{
    return (context: RequirementType.RequirementContext): number =>
    {
        if (context.zoneAssociatedPlanetOwnerPlayerId === undefined)
        {
            throw new Error(`canTargetPlayerByScore requirement evaluated without zone-associated planet ownership info.`);
        }

        const targetOwnerPlayerId: number | null = context.zoneAssociatedPlanetOwnerPlayerId;

        if (targetOwnerPlayerId === null || targetOwnerPlayerId === context.playerData.playerRow.id)
        {
            return 1;
        }

        const targetScore: number = ScoreData.getPublicPlayerScore(context.playerData.publicPlayerRows, targetOwnerPlayerId);
        if (targetScore >= SCORE_TARGET_PROTECTION_THRESHOLD)
        {
            return 1;
        }

        const attackerScore: number = ScoreData.getPublicPlayerScore(context.playerData.publicPlayerRows, context.playerData.playerRow.id);
        return attackerScore < targetScore * MAX_ATTACKER_TO_TARGET_SCORE_RATIO ? 1 : 0;
    };
}