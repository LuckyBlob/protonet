import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as BuildingData from "@/lib/gameplay/dynamicData/planet/buildingData";
import * as RequirementType from "@/lib/gameplay/coreData/requirement/requirementTypes";
import * as BuildingUpgradeData from "@/lib/gameplay/dynamicData/planet/buildingUpgradeData";
import * as BuildingDeconstructionData from "@/lib/gameplay/dynamicData/planet/buildingDeconstructionData";
import * as UnitData from "@/lib/gameplay/dynamicData/planet/unitData";
import * as ResearchData from "@/lib/gameplay/dynamicData/player/researchData";
import * as CalculatedValueData from "@/lib/gameplay/dynamicData/calculatedValueData";
import * as MissileSpaceData from "@/lib/gameplay/dynamicData/planet/missileSpaceData";
import * as ScoreData from "@/lib/gameplay/dynamicData/player/scoreData";
import * as StaticDataHelper from "@/lib/gameplay/coreData/static/staticDataHelpers";
import * as FleetRange from "@/lib/gameplay/coreData/formula/fleetRangeFormulas";

const SCORE_TARGET_PROTECTION_THRESHOLD: number = 500000;
const MAX_ATTACKER_TO_TARGET_SCORE_RATIO: number = 5;
const GRAVITON_BASE_ENERGY_REQUIREMENT: number = 300000;
const GRAVITON_ENERGY_GROWTH_FACTOR: number = 3;

function getPlanetData(playerData: CoreType.PlayerData, planetId: number): CoreType.PlanetData
{
    const planetData: CoreType.PlanetData | null = CoreType.getPlanetDataForId(playerData.planetDatas, planetId);
    if (planetData === null)
    {
        throw new Error(`No PlanetData for planetId ${planetId}`);
    }
    return planetData;
}

function isAnyBuildingUpgradeInProgress(): RequirementType.RequirementValueGetter
{
    return (context: RequirementType.RequirementContext): number =>
    {
        const planetData: CoreType.PlanetData = getPlanetData(context.playerData, context.planetId);
        return planetData.dynamicPlanetData.buildingUpgrades.length > 0 ? 1 : 0;
    };
}
export const IS_ANY_BUILDING_UPGRADE_IN_PROGRESS: RequirementType.RequirementCondition =
{
    valueGetter: isAnyBuildingUpgradeInProgress(),
    failureDescription: "A building upgrade is already in progress.",
}

function isAnyBuildingDeconstructionInProgress(): RequirementType.RequirementValueGetter
{
    return (context: RequirementType.RequirementContext): number =>
    {
        const planetData: CoreType.PlanetData = getPlanetData(context.playerData, context.planetId);
        return planetData.dynamicPlanetData.buildingDeconstructions.length > 0 ? 1 : 0;
    };
}
export const IS_ANY_BUILDING_DECONSTRUCTION_IN_PROGRESS: RequirementType.RequirementCondition =
{
    valueGetter: isAnyBuildingDeconstructionInProgress(),
    failureDescription: "A building deconstruction is already in progress.",
}

function isAnyUnitBeingConstructed(): RequirementType.RequirementValueGetter
{
    return (context: RequirementType.RequirementContext): number =>
    {
        const planetData: CoreType.PlanetData = getPlanetData(context.playerData, context.planetId);
        return planetData.dynamicPlanetData.unitConstructions.length > 0 ? 1 : 0;
    };
}
export const IS_ANY_UNIT_BEING_CONSTRUCTED: RequirementType.RequirementCondition =
{
    valueGetter: isAnyUnitBeingConstructed(),
    failureDescription: "A unit is already being constructed.",
}

function isAnyResearchInProgress(): RequirementType.RequirementValueGetter
{
    return (context: RequirementType.RequirementContext): number =>
    {
        return context.playerData.dynamicPlayerData.currentlyResearchings.length > 0 ? 1 : 0;
    };
}
export const IS_ANY_RESEARCH_IN_PROGRESS: RequirementType.RequirementCondition =
{
    valueGetter: isAnyResearchInProgress(),
    failureDescription: "A research is already in progress.",
}

function buildingLevel(): RequirementType.RequirementValueGetter
{
    return (context: RequirementType.RequirementContext, requirement: RequirementType.Requirement): number =>
    {
        const planetData: CoreType.PlanetData = getPlanetData(context.playerData, context.planetId);
        return BuildingData.getBuildingLevel(planetData, requirement.specificThingType as GameType.BuildingType);
    };
}
export const BUILDING_LEVEL: RequirementType.RequirementCondition =
{
    valueGetter: buildingLevel(),
    failureDescription: "Building level requirement not met.",
}

function researchLevel(): RequirementType.RequirementValueGetter
{
    return (context: RequirementType.RequirementContext, requirement: RequirementType.Requirement): number =>
    {
        return ResearchData.getResearchLevel(context.playerData, requirement.specificThingType as GameType.ResearchType);
    };
}
export const RESEARCH_LEVEL: RequirementType.RequirementCondition =
{
    valueGetter: researchLevel(),
    failureDescription: "Research level requirement not met.",
}

function ownedAndQueuedUnitCount(): RequirementType.RequirementValueGetter
{
    return (context: RequirementType.RequirementContext, requirement: RequirementType.Requirement): number =>
    {
        const planetData: CoreType.PlanetData = getPlanetData(context.playerData, context.planetId);
        return UnitData.getOwnedAndQueuedUnitQuantity(planetData, requirement.specificThingType as GameType.UnitType);
    };
}
export const OWNED_AND_QUEUED_UNIT_COUNT: RequirementType.RequirementCondition =
{
    valueGetter: ownedAndQueuedUnitCount(),
    failureDescription: "Maximum build count reached.",
}

function isSpecificBuildingBeingUpgraded(): RequirementType.RequirementValueGetter
{
    return (context: RequirementType.RequirementContext, requirement: RequirementType.Requirement): number =>
    {
        const planetData: CoreType.PlanetData = getPlanetData(context.playerData, context.planetId);
        const isUpgrading: boolean = BuildingUpgradeData.isBuildingTypeCurrentlyUpgrading(planetData, requirement.specificThingType as GameType.BuildingType);
        return isUpgrading ? 1 : 0;
    };
}
export const IS_SPECIFIC_BUILDING_BEING_UPGRADED: RequirementType.RequirementCondition =
{
    valueGetter: isSpecificBuildingBeingUpgraded(),
    failureDescription: "That building is currently being upgraded.",
}

function isSpecificBuildingBeingDeconstructed(): RequirementType.RequirementValueGetter
{
    return (context: RequirementType.RequirementContext, requirement: RequirementType.Requirement): number =>
    {
        const planetData: CoreType.PlanetData = getPlanetData(context.playerData, context.planetId);
        const isDeconstructing: boolean = BuildingDeconstructionData.isBuildingTypeCurrentlyDeconstructing(planetData, requirement.specificThingType as GameType.BuildingType);
        return isDeconstructing ? 1 : 0;
    };
}
export const IS_SPECIFIC_BUILDING_BEING_DECONSTRUCTED: RequirementType.RequirementCondition =
{
    valueGetter: isSpecificBuildingBeingDeconstructed(),
    failureDescription: "That building is currently being deconstructed.",
}

function playerPlanetCount(): RequirementType.RequirementValueGetter
{
    return (context: RequirementType.RequirementContext): number =>
    {
        return CoreType.getOwnedPlanets(context.playerData.planetDatas).length;
    };
}
export const PLAYER_PLANET_COUNT: RequirementType.RequirementCondition =
{
    valueGetter: playerPlanetCount(),
    failureDescription: "Planet count requirement not met.",
}

function freeColonyPlanetSlots(): RequirementType.RequirementValueGetter
{
    return (context: RequirementType.RequirementContext): number =>
    {
        return CalculatedValueData.computeFreeColonyPlanetSlots(context.playerData);
    };
}
export const FREE_COLONY_PLANET_SLOTS: RequirementType.RequirementCondition =
{
    valueGetter: freeColonyPlanetSlots(),
    failureDescription: "No free colony slots available.",
}

function hasFreeFleetSlot(): RequirementType.RequirementValueGetter
{
    return (context: RequirementType.RequirementContext): number =>
    {
        const maximumFleetSlots: number = CalculatedValueData.computePlayerValueNet(context.playerData, GameType.PlayerValueType.FleetSlots);

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
export const HAS_FREE_FLEET_SLOT: RequirementType.RequirementCondition =
{
    valueGetter: hasFreeFleetSlot(),
    failureDescription: "No free fleet slot available.",
}

function freeMissileSpace(): RequirementType.RequirementValueGetter
{
    return (context: RequirementType.RequirementContext): number =>
    {
        const planetData: CoreType.PlanetData = getPlanetData(context.playerData, context.planetId);
        return MissileSpaceData.computeFreeMissileSpace(planetData, context.playerData);
    };
}
export const FREE_MISSILE_SPACE: RequirementType.RequirementCondition =
{
    valueGetter: freeMissileSpace(),
    failureDescription: "Not enough missile space.",
}

function freeSize(): RequirementType.RequirementValueGetter
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
export const FREE_SIZE: RequirementType.RequirementCondition =
{
    valueGetter: freeSize(),
    failureDescription: "No free fields available.",
}

function energyProduction(): RequirementType.RequirementValueGetter
{
    return (context: RequirementType.RequirementContext): number =>
    {
        const planetData: CoreType.PlanetData = getPlanetData(context.playerData, context.planetId);
        const energyValueData: CoreType.CalculatedValueData | null = CalculatedValueData.computePlanetValueData(planetData, GameType.PlanetValueType.Energy, context.playerData);
        return energyValueData === null ? 0 : energyValueData.production;
    };
}
export const ENERGY_PRODUCTION: RequirementType.RequirementCondition =
{
    valueGetter: energyProduction(),
    failureDescription: "Energy production requirement not met.",
}

export function gravitonEnergyRequirement(): RequirementType.RequirementValueGetter
{
    return (context: RequirementType.RequirementContext): number =>
    {
        const currentGravitonLevel: number = ResearchData.getResearchLevel(context.playerData, GameType.ResearchType.GravitonTech);
        return GRAVITON_BASE_ENERGY_REQUIREMENT * Math.pow(GRAVITON_ENERGY_GROWTH_FACTOR, currentGravitonLevel);
    };
}

function isZoneAssociatedPlanetOwned(): RequirementType.RequirementValueGetter
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
export const IS_ZONE_ASSOCIATED_PLANET_OWNED: RequirementType.RequirementCondition =
{
    valueGetter: isZoneAssociatedPlanetOwned(),
    failureDescription: "Target planet ownership requirement not met.",
}

function getTargetPlanetZone(): RequirementType.RequirementValueGetter
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
export const GET_TARGET_PLANET_ZONE: RequirementType.RequirementCondition =
{
    valueGetter: getTargetPlanetZone(),
    failureDescription: (requirement: RequirementType.Requirement): string =>
    {
        const requiredZone: GameType.PlanetZone = requirement.value as GameType.PlanetZone;
        return `Target must be a ${StaticDataHelper.getPlanetZoneInfo(requiredZone).displayName.toLowerCase()}.`;
    },
}

function isTargetPlanetZoneSpyable(): RequirementType.RequirementValueGetter
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
export const IS_TARGET_PLANET_ZONE_SPYABLE: RequirementType.RequirementCondition =
{
    valueGetter: isTargetPlanetZoneSpyable(),
    failureDescription: "Target zone cannot be spied.",
}

function isTargetPlanetZoneAttackable(): RequirementType.RequirementValueGetter
{
    return (context: RequirementType.RequirementContext): number =>
    {
        if (context.targetPlanetAddress === undefined)
        {
            throw new Error(`isTargetPlanetZoneAttackable requirement evaluated without a target planet address.`);
        }

        return StaticDataHelper.canPlanetZoneBeAttacked(context.targetPlanetAddress.zone) === true ? 1 : 0;
    };
}
export const IS_TARGET_PLANET_ZONE_ATTACKABLE: RequirementType.RequirementCondition =
{
    valueGetter: isTargetPlanetZoneAttackable(),
    failureDescription: "Target zone cannot be attacked.",
}

function doesTargetZoneExist(): RequirementType.RequirementValueGetter
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
export const DOES_TARGET_ZONE_EXIST: RequirementType.RequirementCondition =
{
    valueGetter: doesTargetZoneExist(),
    failureDescription: "The target does not exist.",
}

function transportedResourceTotal(): RequirementType.RequirementValueGetter
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
export const TRANSPORTED_RESOURCE_TOTAL: RequirementType.RequirementCondition =
{
    valueGetter: transportedResourceTotal(),
    failureDescription: "No resources selected to transport.",
}

function allFleetUnitsCanTargetDebrisField(): RequirementType.RequirementValueGetter
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
export const ALL_FLEET_UNITS_CAN_TARGET_DEBRIS_FIELD: RequirementType.RequirementCondition =
{
    valueGetter: allFleetUnitsCanTargetDebrisField(),
    failureDescription: "Some units cannot target a debris field.",
}

function allFleetUnitsCanSpy(): RequirementType.RequirementValueGetter
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
export const ALL_FLEET_UNITS_CAN_SPY: RequirementType.RequirementCondition =
{
    valueGetter: allFleetUnitsCanSpy(),
    failureDescription: "Some units cannot spy.",
}

function canTargetPlayerByScore(): RequirementType.RequirementValueGetter
{
    return (context: RequirementType.RequirementContext): number =>
    {
        if (context.zoneAssociatedPlanetOwnerPlayerId === undefined)
        {
            throw new Error(`canTargetPlayerByScore requirement evaluated without zone-associated planet ownership info.`);
        }

        if (context.playerData.adminLevel === 0)
        {
            return 1;
        }

        const targetOwnerPlayerId: number | null = context.zoneAssociatedPlanetOwnerPlayerId;

        if (targetOwnerPlayerId === null || targetOwnerPlayerId === context.playerData.playerRow.id)
        {
            return 1;
        }

        const targetPublicPlayerData: CoreType.PublicPlayerData = CoreType.getPublicPlayerDataForId(context.playerData.publicPlayerDatas, targetOwnerPlayerId);
        if (targetPublicPlayerData.isPlayerInactive === true)
        {
            return 1;
        }

        if (targetPublicPlayerData.score >= SCORE_TARGET_PROTECTION_THRESHOLD)
        {
            return 1;
        }

        const attackerScore: number = ScoreData.getPublicPlayerScore(context.playerData.publicPlayerDatas, context.playerData.playerRow.id);
        return attackerScore < targetPublicPlayerData.score * MAX_ATTACKER_TO_TARGET_SCORE_RATIO ? 1 : 0;
    };
}
export const CAN_TARGET_PLAYER_BY_SCORE: RequirementType.RequirementCondition =
{
    valueGetter: canTargetPlayerByScore(),
    failureDescription: "Target is protected by the score ratio.",
}

function isTargetEnemyOwned(): RequirementType.RequirementValueGetter
{
    return (context: RequirementType.RequirementContext): number =>
    {
        if (context.zoneAssociatedPlanetOwnerPlayerId === undefined)
        {
            throw new Error(`isTargetEnemyOwned requirement evaluated without zone-associated planet ownership info.`);
        }

        const targetOwnerPlayerId: number | null = context.zoneAssociatedPlanetOwnerPlayerId;
        if (targetOwnerPlayerId === null || targetOwnerPlayerId === context.playerData.playerRow.id)
        {
            return 0;
        }

        return 1;
    };
}
export const IS_TARGET_ENEMY_OWNED: RequirementType.RequirementCondition =
{
    valueGetter: isTargetEnemyOwned(),
    failureDescription: "Target must be owned by another player.",
}

function isTargetWithinRange(): RequirementType.RequirementValueGetter
{
    return (context: RequirementType.RequirementContext): number =>
    {
        if (context.targetPlanetAddress === undefined)
        {
            throw new Error(`isTargetWithinRange requirement evaluated without a target planet address.`);
        }

        if (context.unitQuantities === undefined)
        {
            throw new Error(`isTargetWithinRange requirement evaluated without a potential fleet action.`);
        }

        const originPlanetData: CoreType.PlanetData = getPlanetData(context.playerData, context.planetId);
        const originAddress: GameType.PlanetAddress = CoreType.getPlanetAddress(originPlanetData);
        const impulseDriveLevel: number = ResearchData.getResearchLevel(context.playerData, GameType.ResearchType.ImpulseDrive);

        for (const [unitType, unitQuantity] of context.unitQuantities)
        {
            if (unitQuantity <= 0)
            {
                continue;
            }

            const speedStats: GameType.SpeedStats | undefined = StaticDataHelper.getUnitStats(unitType).speed;
            if (speedStats === undefined)
            {
                continue;
            }

            if (FleetRange.isWithinRange(originAddress, context.targetPlanetAddress, speedStats, impulseDriveLevel) === false)
            {
                return 0;
            }
        }

        return 1;
    };
}
export const IS_TARGET_WITHIN_RANGE: RequirementType.RequirementCondition =
{
    valueGetter: isTargetWithinRange(),
    failureDescription: "Target is out of range.",
}

function allFleetUnitsAreLaunchableMissiles(): RequirementType.RequirementValueGetter
{
    return (context: RequirementType.RequirementContext): number =>
    {
        if (context.unitQuantities === undefined)
        {
            throw new Error(`allFleetUnitsAreLaunchableMissiles requirement evaluated without a potential fleet action.`);
        }

        for (const [unitType, unitQuantity] of context.unitQuantities)
        {
            if (unitQuantity <= 0)
            {
                continue;
            }

            if (StaticDataHelper.canUnitLaunchAsMissile(unitType) === false)
            {
                return 0;
            }
        }

        return 1;
    };
}
export const ALL_FLEET_UNITS_ARE_LAUNCHABLE_MISSILES: RequirementType.RequirementCondition =
{
    valueGetter: allFleetUnitsAreLaunchableMissiles(),
    failureDescription: "Some units are not launchable missiles.",
}

function fleetHasColonizeUnit(): RequirementType.RequirementValueGetter
{
    return (context: RequirementType.RequirementContext): number =>
    {
        if (context.unitQuantities === undefined)
        {
            throw new Error(`fleetHasColonizeUnit requirement evaluated without a potential fleet action.`);
        }

        for (const [unitType, unitQuantity] of context.unitQuantities)
        {
            if (unitQuantity <= 0)
            {
                continue;
            }

            if (StaticDataHelper.unitParticipatesInColonization(unitType) === true)
            {
                return 1;
            }
        }

        return 0;
    };
}
export const FLEET_HAS_COLONIZE_UNIT: RequirementType.RequirementCondition =
{
    valueGetter: fleetHasColonizeUnit(),
    failureDescription: "Fleet has no unit that can colonize.",
}

function fleetHasMoonDestructionUnit(): RequirementType.RequirementValueGetter
{
    return (context: RequirementType.RequirementContext): number =>
    {
        if (context.unitQuantities === undefined)
        {
            throw new Error(`fleetHasMoonDestructionUnit requirement evaluated without a potential fleet action.`);
        }

        for (const [unitType, unitQuantity] of context.unitQuantities)
        {
            if (unitQuantity <= 0)
            {
                continue;
            }

            if (StaticDataHelper.unitParticipatesInMoonDestruction(unitType) === true)
            {
                return 1;
            }
        }

        return 0;
    };
}
export const FLEET_HAS_MOON_DESTRUCTION_UNIT: RequirementType.RequirementCondition =
{
    valueGetter: fleetHasMoonDestructionUnit(),
    failureDescription: "Fleet has no moon-destruction unit.",
}
