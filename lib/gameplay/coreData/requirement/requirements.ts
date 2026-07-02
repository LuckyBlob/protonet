import * as ThingType from "@/lib/gameplay/coreData/thing/thingTypes";
import * as ThingData from "@/lib/gameplay/coreData/thing/thingData";
import * as ThingHelpers from "@/lib/gameplay/coreData/thing/thingHelpers";
import * as ThingDataHelpers from "@/lib/gameplay/coreData/thing/thingDataHelpers";
import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as RequirementType from "@/lib/gameplay/coreData/requirement/requirementTypes";
import * as StaticData from "@/lib/gameplay/coreData/static/staticData";
import * as StaticDataHelper from "@/lib/gameplay/coreData/static/staticDataHelpers";

export function getFailedBuildingUpgradeRequirements(playerData: CoreType.PlayerData, buildingType: GameType.BuildingType, planetId: number): RequirementType.Requirement[]
{
    const requirementContext: RequirementType.RequirementContext =
    {
        playerData: playerData,
        planetId: planetId,
    };
    const requirements: RequirementType.Requirement[] = getRequirements({ thingType: ThingType.Thing.BuildingUpgrade, specificThingType: buildingType });
    return getFailedRequirements(requirementContext, requirements);
}

export function getFailedBuildingDeconstructionRequirements(playerData: CoreType.PlayerData, buildingType: GameType.BuildingType, planetId: number): RequirementType.Requirement[]
{
    const requirementContext: RequirementType.RequirementContext =
    {
        playerData: playerData,
        planetId: planetId,
    };
    const requirements: RequirementType.Requirement[] = getRequirements({ thingType: ThingType.Thing.BuildingDeconstruction, specificThingType: buildingType });
    return getFailedRequirements(requirementContext, requirements);
}

export function getFailedUnitBuildRequirements(playerData: CoreType.PlayerData, unitType: GameType.UnitType, planetId: number): RequirementType.Requirement[]
{
    const requirementContext: RequirementType.RequirementContext =
    {
        playerData: playerData,
        planetId: planetId,
    };
    const requirements: RequirementType.Requirement[] = getRequirements({ thingType: ThingType.Thing.UnitConstruction, specificThingType: unitType });
    return getFailedRequirements(requirementContext, requirements);
}

export function getFailedResearchRequirements(playerData: CoreType.PlayerData, researchType: GameType.ResearchType, planetId: number): RequirementType.Requirement[]
{
    const requirementContext: RequirementType.RequirementContext =
    {
        playerData: playerData,
        planetId: planetId,
    };
    const requirements: RequirementType.Requirement[] = getRequirements({ thingType: ThingType.Thing.ResearchingResearch, specificThingType: researchType });
    return getFailedRequirements(requirementContext, requirements);
}

export function getFailedFleetMovementRequirements(playerData: CoreType.PlayerData, fleetActionType: GameType.FleetActionType, planetId: number, unitQuantities: Map<GameType.UnitType, number>, transportedResourceQuantities: Map<GameType.ResourceType, number>, targetPlanetAddress: GameType.PlanetAddress, zoneAssociatedPlanetOwnerPlayerId: number | null, targetZoneExists: boolean): RequirementType.Requirement[]
{
    const requirementContext: RequirementType.RequirementContext =
    {
        playerData: playerData,
        planetId: planetId,
        unitQuantities: unitQuantities,
        transportedResourceQuantities: transportedResourceQuantities,
        targetPlanetAddress: targetPlanetAddress,
        zoneAssociatedPlanetOwnerPlayerId: zoneAssociatedPlanetOwnerPlayerId,
        targetZoneExists: targetZoneExists,
    };
    const requirements: RequirementType.Requirement[] = getRequirements({ thingType: ThingType.Thing.FleetMovement, specificThingType: fleetActionType });
    return getFailedRequirements(requirementContext, requirements);
}

export function getRequirementDescriptions(failedRequirements: RequirementType.Requirement[], playerData: CoreType.PlayerData, planetId: number): string[]
{
    const requirementContext: RequirementType.RequirementContext =
    {
        playerData: playerData,
        planetId: planetId,
    };
    const descriptions: string[] = [];

    for (const requirement of failedRequirements)
    {
        const description: string | null = describeSingleRequirement(requirementContext, requirement);
        if (description !== null)
        {
            descriptions.push(description);
        }
    }

    return descriptions;
}

// --- internals ---
function getRequirements(specificThing: ThingType.SpecificThingType): RequirementType.Requirement[]
{
    const globalRequirements: RequirementType.Requirement[] = StaticData.GLOBAL_REQUIREMENTS.get(specificThing.thingType) ?? [];
    const specificRequirements: RequirementType.Requirement[] = StaticDataHelper.getSpecificThingRequirements(specificThing);

    return [...globalRequirements, ...specificRequirements];
}

function resolveValueToNumber(requirementContext: RequirementType.RequirementContext, value: number | boolean | RequirementType.ThingValueGetter, operator: RequirementType.RequirementOperator): number
{
    if (typeof value === "function")
    {
        return value(requirementContext);
    }

    if (typeof value !== "boolean")
    {
        return value;
    }

    if (operator !== RequirementType.RequirementOperator.Equal)
    {
        throw new Error(`UNREACHABLE: Boolean value can only be used with the Equal operator.`);
    }

    return value ? 1 : 0;
}

function compare(valueGetter: number, operator: RequirementType.RequirementOperator, threshold: number): boolean
{
    if (operator === RequirementType.RequirementOperator.GreaterThan)
    {
        return valueGetter > threshold;
    }

    if (operator === RequirementType.RequirementOperator.GreaterOrEqual)
    {
        return valueGetter >= threshold;
    }

    if (operator === RequirementType.RequirementOperator.Equal)
    {
        return valueGetter === threshold;
    }

    if (operator === RequirementType.RequirementOperator.LesserOrEqual)
    {
        return valueGetter <= threshold;
    }

    if (operator === RequirementType.RequirementOperator.LesserThan)
    {
        return valueGetter < threshold;
    }

    throw new Error(`UNREACHABLE: Unknown RequirementOperator ${operator}`);
}

function operatorToString(operator: RequirementType.RequirementOperator): string
{
    if (operator === RequirementType.RequirementOperator.GreaterThan)
    {
        return ">";
    }

    if (operator === RequirementType.RequirementOperator.GreaterOrEqual)
    {
        return ">=";
    }

    if (operator === RequirementType.RequirementOperator.Equal)
    {
        return "=";
    }

    if (operator === RequirementType.RequirementOperator.LesserOrEqual)
    {
        return "<=";
    }

    if (operator === RequirementType.RequirementOperator.LesserThan)
    {
        return "<";
    }

    throw new Error(`UNREACHABLE: Unknown RequirementOperator ${operator}`);
}

function meetsSingleRequirement(requirementContext: RequirementType.RequirementContext, requirement: RequirementType.Requirement): boolean
{
    if (requirement.thingRequirement !== undefined)
    {
        const thingRequirement: RequirementType.ThingRequirement = requirement.thingRequirement;
        const thingValueGetter: number = thingRequirement.valueGetter(requirementContext);
        const threshold: number = resolveValueToNumber(requirementContext, thingRequirement.value, thingRequirement.operator);

        const conditionRespected: boolean = compare(thingValueGetter, thingRequirement.operator, threshold);
        if (conditionRespected === false)
        {
            return false;
        }
    }

    if (requirement.specificThingRequirement !== undefined)
    {
        const specificThingRequirement: RequirementType.SpecificThingRequirement = requirement.specificThingRequirement;
        const specificThingValueGetter: number = specificThingRequirement.valueGetter(requirementContext);
        const threshold: number = resolveValueToNumber(requirementContext, specificThingRequirement.value, specificThingRequirement.operator);

        const conditionRespected: boolean = compare(specificThingValueGetter, specificThingRequirement.operator, threshold);
        if (conditionRespected === false)
        {
            return false;
        }
    }

    return true;
}

function getFailedRequirements(requirementContext: RequirementType.RequirementContext, requirements: RequirementType.Requirement[]): RequirementType.Requirement[]
{
    const planetData: CoreType.PlanetData | null = CoreType.getPlanetDataForId(requirementContext.playerData.planetDatas, requirementContext.planetId);
    const planetZone: GameType.PlanetZone | null = planetData === null ? null : planetData.planetRow.zone as GameType.PlanetZone;

    return requirements.filter((requirement: RequirementType.Requirement): boolean =>
    {
        if (requirement.applicableZones !== undefined && planetZone !== null && requirement.applicableZones.includes(planetZone) === false)
        {
            return false;
        }

        return meetsSingleRequirement(requirementContext, requirement) === false;
    });
}

function describeSingleRequirement(requirementContext: RequirementType.RequirementContext, requirement: RequirementType.Requirement): string | null
{
    if (requirement.thingRequirement !== undefined)
    {
        const thingRequirement: RequirementType.ThingRequirement = requirement.thingRequirement;

        if (thingRequirement.thingType === ThingType.Thing.BuildingUpgrade)
        {
            return null;
        }

        if (thingRequirement.thingType === ThingType.Thing.ResearchingResearch)
        {
            return null;
        }

        if (thingRequirement.thingType === ThingType.Thing.UnitConstruction)
        {
            return null;
        }

        const thingValueGetter: number = thingRequirement.valueGetter(requirementContext);
        const threshold: number = resolveValueToNumber(requirementContext, thingRequirement.value, thingRequirement.operator);
        const operatorString: string = operatorToString(thingRequirement.operator);
        const thingName: string | undefined = ThingData.THING_DISPLAY_NAMES.get(thingRequirement.thingType);

        if (thingName === undefined)
        {
            throw new Error(`UNREACHABLE: No display name for Thing ${thingRequirement.thingType}`);
        }

        return `Total ${thingName} ${operatorString} ${threshold} (current: ${thingValueGetter})`;
    }

    if (requirement.specificThingRequirement !== undefined)
    {
        const specificThingRequirement: RequirementType.SpecificThingRequirement = requirement.specificThingRequirement;

        if (specificThingRequirement.thingType === ThingType.Thing.BuildingUpgrade)
        {
            const buildingName: string = ThingDataHelpers.getSpecificThingName(ThingHelpers.building(specificThingRequirement.specificThingType));
            return `${buildingName} upgrading`;
        }

        const specificName: string = ThingDataHelpers.getSpecificThingName({ thingType: specificThingRequirement.thingType, specificThingType: specificThingRequirement.specificThingType });
        const specificThingValueGetter: number = specificThingRequirement.valueGetter(requirementContext);
        const threshold: number = resolveValueToNumber(requirementContext, specificThingRequirement.value, specificThingRequirement.operator);
        const operatorString: string = operatorToString(specificThingRequirement.operator);

        return `${specificName} ${operatorString} ${threshold} (current: ${specificThingValueGetter})`;
    }

    return null;
}
