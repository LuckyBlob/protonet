import * as ThingType from "@/lib/gameplay/coreData/type/thingTypes";
import * as PlayerDataType from "@/lib/gameplay/gameplayData/player/playerDataTypes";
import * as RequirementMap from "@/lib/gameplay/coreData/requirement/requirementMap";
import * as RequirementType from "@/lib/gameplay/coreData/requirement/requirementTypes";

export function getFailedBuildingUpgradeRequirements(playerData: PlayerDataType.PlayerData, buildingType: number, planetId: number): RequirementType.Requirement[]
{
    return getFailedRequirementsInternal(playerData, planetId, ThingType.Thing.BuildingUpgrade, buildingType);
}

export function getFailedShipBuildRequirements(playerData: PlayerDataType.PlayerData, shipType: number, planetId: number): RequirementType.Requirement[]
{
    return getFailedRequirementsInternal(playerData, planetId, ThingType.Thing.ShipBatchConstruction, shipType);
}

export function getFailedFleetMovementRequirements(playerData: PlayerDataType.PlayerData, shipType: number, planetId: number): RequirementType.Requirement[]
{
    return getFailedRequirementsInternal(playerData, planetId, ThingType.Thing.FleetMovement, shipType);
}

export function getRequirementDescriptions(failedRequirements: RequirementType.Requirement[], playerData: PlayerDataType.PlayerData, planetId: number): string[]
{
    const descriptions: string[] = [];

    for (const requirement of failedRequirements)
    {
        const description: string | null = describeSingleRequirement(playerData, planetId, requirement);
        if (description !== null)
        {
            descriptions.push(description);
        }
    }

    return descriptions;
}

// --- internals ---

function getRequirements(thingType: ThingType.Thing, specificThing: ThingType.SpecificThing): RequirementType.Requirement[]
{
    const specificThingRequirements: ReadonlyMap<ThingType.SpecificThing, RequirementType.Requirement[]> | undefined = RequirementMap.REQUIREMENT_MAP.get(thingType);

    if (specificThingRequirements === undefined)
    {
        return [];
    }

    const requirements: RequirementType.Requirement[] | undefined = specificThingRequirements.get(specificThing);

    if (requirements === undefined)
    {
        return [];
    }

    return requirements;
}

function resolveValueToNumber(value: number | boolean, operator: RequirementType.RequirementOperator): number
{
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

function meetsSingleRequirement(playerData: PlayerDataType.PlayerData, planetId: number, requirement: RequirementType.Requirement): boolean
{
    if (requirement.thingRequirement !== undefined)
    {
        const thingRequirement: RequirementType.ThingRequirement = requirement.thingRequirement;
        const thingValueGetter: number = thingRequirement.valueGetter(playerData, planetId);
        const threshold: number = resolveValueToNumber(thingRequirement.value, thingRequirement.operator);

        const conditionRespected: boolean = compare(thingValueGetter, thingRequirement.operator, threshold);
        if (conditionRespected === false)
        {
            return false;
        }
    }

    if (requirement.specificThingRequirement !== undefined)
    {
        const specificThingRequirement: RequirementType.SpecificThingRequirement = requirement.specificThingRequirement;
        const specificThingValueGetter: number = specificThingRequirement.valueGetter(playerData, planetId);
        const threshold: number = resolveValueToNumber(specificThingRequirement.value, specificThingRequirement.operator);

        const conditionRespected: boolean = compare(specificThingValueGetter, specificThingRequirement.operator, threshold);
        if (conditionRespected === false)
        {
            return false;
        }
    }

    return true;
}

function getFailedRequirementsInternal(playerData: PlayerDataType.PlayerData, planetId: number, thingType: ThingType.Thing, specificThing: ThingType.SpecificThing): RequirementType.Requirement[]
{
    const requirements: RequirementType.Requirement[] = getRequirements(thingType, specificThing);
    return requirements.filter((requirement: RequirementType.Requirement): boolean =>
    {
        return !meetsSingleRequirement(playerData, planetId, requirement);
    });
}

function describeSingleRequirement(playerData: PlayerDataType.PlayerData, planetId: number, requirement: RequirementType.Requirement): string | null
{
    if (requirement.thingRequirement !== undefined)
    {
        const thingRequirement: RequirementType.ThingRequirement = requirement.thingRequirement;

        if (thingRequirement.thingType === ThingType.Thing.BuildingUpgrade)
        {
            return null;
        }

        const thingValueGetter: number = thingRequirement.valueGetter(playerData, planetId);
        const threshold: number = resolveValueToNumber(thingRequirement.value, thingRequirement.operator);
        const opStr: string = operatorToString(thingRequirement.operator);
        const thingName: string | undefined = ThingType.THING_DISPLAY_NAMES.get(thingRequirement.thingType);

        if (thingName === undefined)
        {
            throw new Error(`UNREACHABLE: No display name for Thing ${thingRequirement.thingType}`);
        }

        return `Total ${thingName} ${opStr} ${threshold} (current: ${thingValueGetter})`;
    }

    if (requirement.specificThingRequirement !== undefined)
    {
        const specificThingRequirement: RequirementType.SpecificThingRequirement = requirement.specificThingRequirement;

        if (specificThingRequirement.thingType === ThingType.Thing.BuildingUpgrade)
        {
            const buildingName: string = ThingType.getSpecificThingName(ThingType.building(specificThingRequirement.specificThingType));
            return `${buildingName} upgrading`;
        }

        const specificName: string = ThingType.getSpecificThingName({ thingType: specificThingRequirement.thingType, specificThingType: specificThingRequirement.specificThingType });
        const specificThingValueGetter: number = specificThingRequirement.valueGetter(playerData, planetId);
        const threshold: number = resolveValueToNumber(specificThingRequirement.value, specificThingRequirement.operator);
        const opStr: string = operatorToString(specificThingRequirement.operator);

        return `${specificName} ${opStr} ${threshold} (current: ${specificThingValueGetter})`;
    }

    return null;
}
