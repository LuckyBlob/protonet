import * as ThingType from "@/lib/gameplay/coreData/thing/thingTypes";
import * as ThingData from "@/lib/gameplay/coreData/thing/thingData";
import * as ThingHelpers from "@/lib/gameplay/coreData/thing/thingHelpers";
import * as ThingDataHelpers from "@/lib/gameplay/coreData/thing/thingDataHelpers";
import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as RequirementType from "@/lib/gameplay/coreData/requirement/requirementTypes";
import * as StaticData from "@/lib/gameplay/coreData/static/staticData";

export function getFailedBuildingUpgradeRequirements(playerData: CoreType.PlayerData, buildingType: GameType.BuildingType, planetId: number): RequirementType.Requirement[]
{
    const requirementContext: RequirementType.RequirementContext =
    {
        playerData: playerData,
        planetId: planetId,
    };
    const requirements: RequirementType.Requirement[] = getBuildingRequirements(ThingType.Thing.BuildingUpgrade, buildingType);
    return getFailedRequirements(requirementContext, requirements);
}

export function getFailedShipBuildRequirements(playerData: CoreType.PlayerData, shipType: GameType.ShipType, planetId: number): RequirementType.Requirement[]
{
    const requirementContext: RequirementType.RequirementContext =
    {
        playerData: playerData,
        planetId: planetId,
    };
    const requirements: RequirementType.Requirement[] = getShipRequirements(ThingType.Thing.ShipConstruction, shipType);
    return getFailedRequirements(requirementContext, requirements);
}

export function getFailedFleetMovementRequirements(playerData: CoreType.PlayerData, fleetActionType: GameType.FleetActionType, planetId: number, shipQuantities: Map<GameType.ShipType, number>, transportedResourceQuantities: Map<GameType.ResourceType, number>, targetPlanetAddress: GameType.PlanetAddress, targetPlanetOwnerPlayerId: number | null): RequirementType.Requirement[]
{
    const requirementContext: RequirementType.RequirementContext =
    {
        playerData: playerData,
        planetId: planetId,
        shipQuantities: shipQuantities,
        transportedResourceQuantities: transportedResourceQuantities,
        targetPlanetAddress: targetPlanetAddress,
        targetPlanetOwnerPlayerId: targetPlanetOwnerPlayerId,
    };
    const requirements: RequirementType.Requirement[] = getFleetActionRequirements(ThingType.Thing.FleetMovement, fleetActionType, shipQuantities, transportedResourceQuantities, targetPlanetAddress);
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
function getBuildingRequirements(thingType: ThingType.Thing, buildingType: GameType.BuildingType): RequirementType.Requirement[]
{
    const globalRequirements: RequirementType.Requirement[] = StaticData.GLOBAL_REQUIREMENTS.get(thingType) ?? [];
    const specificRequirements: RequirementType.Requirement[] = StaticData.BUILDING_STATS.get(buildingType)?.requirements ?? [];

    return [...globalRequirements, ...specificRequirements];
}

function getShipRequirements(thingType: ThingType.Thing, shipType: GameType.ShipType): RequirementType.Requirement[]
{
    const globalRequirements: RequirementType.Requirement[] = StaticData.GLOBAL_REQUIREMENTS.get(thingType) ?? [];
    const specificRequirements: RequirementType.Requirement[] = StaticData.SHIP_STATS.get(shipType)?.requirements ?? [];

    return [...globalRequirements, ...specificRequirements];
}

function getFleetActionRequirements(thingType: ThingType.Thing, fleetActionType: GameType.FleetActionType, shipQuantities: Map<GameType.ShipType, number>, transportedResourceQuantities: Map<GameType.ResourceType, number>, targetPlanetAddress: GameType.PlanetAddress): RequirementType.Requirement[]
{
    const globalRequirements: RequirementType.Requirement[] = StaticData.GLOBAL_REQUIREMENTS.get(thingType) ?? [];
    const specificRequirements: RequirementType.Requirement[] = StaticData.FLEET_ACTION_INFOS.get(fleetActionType)?.requirements ?? [];

    return [...globalRequirements, ...specificRequirements];
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

function meetsSingleRequirement(requirementContext: RequirementType.RequirementContext, requirement: RequirementType.Requirement): boolean
{
    if (requirement.thingRequirement !== undefined)
    {
        const thingRequirement: RequirementType.ThingRequirement = requirement.thingRequirement;
        const thingValueGetter: number = thingRequirement.valueGetter(requirementContext);
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
        const specificThingValueGetter: number = specificThingRequirement.valueGetter(requirementContext);
        const threshold: number = resolveValueToNumber(specificThingRequirement.value, specificThingRequirement.operator);

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
    return requirements.filter((requirement: RequirementType.Requirement): boolean =>
    {
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

        const thingValueGetter: number = thingRequirement.valueGetter(requirementContext);
        const threshold: number = resolveValueToNumber(thingRequirement.value, thingRequirement.operator);
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
        const threshold: number = resolveValueToNumber(specificThingRequirement.value, specificThingRequirement.operator);
        const operatorString: string = operatorToString(specificThingRequirement.operator);

        return `${specificName} ${operatorString} ${threshold} (current: ${specificThingValueGetter})`;
    }

    return null;
}
