import * as ThingType from "@/lib/gameplay/coreData/thing/thingTypes";
import * as ThingData from "@/lib/gameplay/coreData/thing/thingData";
import * as ThingDataHelpers from "@/lib/gameplay/coreData/thing/thingDataHelpers";
import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as RequirementType from "@/lib/gameplay/coreData/requirement/requirementTypes";
import * as RequirementValueGetters from "@/lib/gameplay/coreData/requirement/requirementValueGetters";
import * as StaticData from "@/lib/gameplay/coreData/static/staticData";
import * as StaticDataHelper from "@/lib/gameplay/coreData/static/staticDataHelpers";

export function getFailedBuildingUpgradeRequirements(requirementContext: RequirementType.RequirementContext, buildingType: GameType.BuildingType): RequirementType.Requirement[]
{
    const requirements: RequirementType.Requirement[] = getRequirements({ thingType: ThingType.Thing.BuildingUpgrade, specificThingType: buildingType });
    return getFailedRequirements(requirementContext, requirements);
}

export function getFailedBuildingDeconstructionRequirements(requirementContext: RequirementType.RequirementContext, buildingType: GameType.BuildingType): RequirementType.Requirement[]
{
    const requirements: RequirementType.Requirement[] = getRequirements({ thingType: ThingType.Thing.BuildingDeconstruction, specificThingType: buildingType });
    return getFailedRequirements(requirementContext, requirements);
}

export function getFailedUnitBuildRequirements(requirementContext: RequirementType.RequirementContext, unitType: GameType.UnitType): RequirementType.Requirement[]
{
    const requirements: RequirementType.Requirement[] = getRequirements({ thingType: ThingType.Thing.UnitConstruction, specificThingType: unitType });
    return getFailedRequirements(requirementContext, requirements);
}

export function getFailedResearchRequirements(requirementContext: RequirementType.RequirementContext, researchType: GameType.ResearchType): RequirementType.Requirement[]
{
    const requirements: RequirementType.Requirement[] = getRequirements({ thingType: ThingType.Thing.ResearchingResearch, specificThingType: researchType });
    return getFailedRequirements(requirementContext, requirements);
}

export function getFailedFleetMovementRequirements(requirementContext: RequirementType.RequirementContext, fleetActionType: GameType.FleetActionType): RequirementType.Requirement[]
{
    const requirements: RequirementType.Requirement[] = getRequirements({ thingType: ThingType.Thing.FleetMovement, specificThingType: fleetActionType });
    return getFailedRequirements(requirementContext, requirements);
}

export function getRemainingBuildableUnitCount(requirementContext: RequirementType.RequirementContext, unitType: GameType.UnitType): number | null
{
    const requirements: RequirementType.Requirement[] = getRequirements({ thingType: ThingType.Thing.UnitConstruction, specificThingType: unitType });

    let remainingBuildableCount: number | null = null;

    for (const requirement of requirements)
    {
        const buildCountCap: number | null = getRequirementUnitConstructionCountCap(requirementContext, requirement, unitType);
        if (buildCountCap === null)
        {
            continue;
        }

        remainingBuildableCount = remainingBuildableCount === null ? buildCountCap : Math.min(remainingBuildableCount, buildCountCap);
    }

    return remainingBuildableCount;
}

export function capUnitQuantitiesByBuildCount(requirementContext: RequirementType.RequirementContext, requestedUnitQuantities: Map<GameType.UnitType, number>): Map<GameType.UnitType, number>
{
    const cappedUnitQuantities: Map<GameType.UnitType, number> = new Map<GameType.UnitType, number>();

    for (const [unitType, requestedUnitQuantity] of requestedUnitQuantities)
    {
        const remainingBuildableCount: number | null = getRemainingBuildableUnitCount(requirementContext, unitType);
        if (remainingBuildableCount === null)
        {
            cappedUnitQuantities.set(unitType, requestedUnitQuantity);
            continue;
        }

        const cappedUnitQuantity: number = Math.min(requestedUnitQuantity, remainingBuildableCount);
        if (cappedUnitQuantity <= 0)
        {
            continue;
        }

        cappedUnitQuantities.set(unitType, cappedUnitQuantity);
    }

    return cappedUnitQuantities;
}

export function getRequirementDescriptions(failedRequirements: RequirementType.Requirement[], requirementContext: RequirementType.RequirementContext): string[]
{
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

export function shouldHideDataWhenRequirementFailed(requirement: RequirementType.Requirement): boolean
{
    if (requirement.hideDataWhenRequirementFailed === undefined)
    {
        throw new Error(`Requirement with operator ${requirement.operator} is missing hideDataWhenRequirementFailed.`);
    }

    return requirement.hideDataWhenRequirementFailed;
}

function getRequirements(specificThing: ThingType.SpecificThingType): RequirementType.Requirement[]
{
    const globalRequirements: RequirementType.Requirement[] = StaticData.GLOBAL_REQUIREMENTS.get(specificThing.thingType) ?? [];
    const specificRequirements: RequirementType.Requirement[] = StaticDataHelper.getSpecificThingRequirements(specificThing);

    return [...globalRequirements, ...specificRequirements];
}

function getRequirementUnitConstructionCountCap(requirementContext: RequirementType.RequirementContext, requirement: RequirementType.Requirement, unitType: GameType.UnitType): number | null
{
    if (requirement.condition !== RequirementValueGetters.OWNED_AND_QUEUED_UNIT_COUNT)
    {
        return null;
    }

    if ((requirement.specificThingType as GameType.UnitType) !== unitType)
    {
        return null;
    }

    const currentUnitCount: number = requirement.condition.valueGetter(requirementContext, requirement);
    const maximumUnitCount: number = resolveValueToNumber(requirementContext, requirement);

    if (requirement.operator === RequirementType.RequirementOperator.LesserThan)
    {
        return Math.max(0, maximumUnitCount - currentUnitCount);
    }

    if (requirement.operator === RequirementType.RequirementOperator.LesserOrEqual)
    {
        return Math.max(0, maximumUnitCount + 1 - currentUnitCount);
    }

    return null;
}

function resolveValueToNumber(requirementContext: RequirementType.RequirementContext, requirement: RequirementType.Requirement): number
{
    const value: number | boolean | RequirementType.RequirementValueGetter = requirement.value;

    if (typeof value === "function")
    {
        return value(requirementContext, requirement);
    }

    if (typeof value !== "boolean")
    {
        return value;
    }

    if (requirement.operator !== RequirementType.RequirementOperator.Equal)
    {
        throw new Error(`UNREACHABLE: Boolean value can only be used with the Equal operator.`);
    }

    return value === true ? 1 : 0;
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
    const currentValue: number = requirement.condition.valueGetter(requirementContext, requirement);
    const threshold: number = resolveValueToNumber(requirementContext, requirement);

    return compare(currentValue, requirement.operator, threshold);
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
    const currentValue: number = requirement.condition.valueGetter(requirementContext, requirement);
    const threshold: number = resolveValueToNumber(requirementContext, requirement);
    const operatorString: string = operatorToString(requirement.operator);

    const failureText: string = typeof requirement.condition.failureDescription === "function" ? requirement.condition.failureDescription(requirement, requirementContext) : requirement.condition.failureDescription;

    if (requirement.specificThingType !== undefined)
    {
        if (requirement.thingType === undefined)
        {
            throw new Error(`UNREACHABLE: If specific thing is set in a requirement, a thing must be set.`);
        }

        const specificThing: ThingType.SpecificThingType =
        {
            thingType: requirement.thingType,
            specificThingType: requirement.specificThingType,
        }

        const specificName: string = ThingDataHelpers.getSpecificThingName(specificThing);

        return failureText + ` - ${specificName} ${operatorString} ${threshold} (current: ${currentValue})`;
    }

    if (requirement.thingType !== undefined)
    {
        const thingName: string | undefined = ThingData.THING_DISPLAY_NAMES.get(requirement.thingType);
        if (thingName === undefined)
        {
            throw new Error(`UNREACHABLE: No display name for Thing ${requirement.thingType}`);
        }
    }

    return failureText;
}
