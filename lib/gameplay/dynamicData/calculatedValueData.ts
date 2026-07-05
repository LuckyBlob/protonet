// Calculated value data: planet values (energy, storage) and player values (fleet slots).
// Planet and player values share the same data shape and aggregation logic and differ only in their
// sources (buildings/units/research) and the value-type domain they range over, so they live together
// here with the merge + accumulate primitives parameterized over the value-type key.
import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as PlanetValueProduction from "@/lib/gameplay/coreData/formula/planetValueProductionFormulas";
import * as PlayerValueProduction from "@/lib/gameplay/coreData/formula/playerValueProductionFormulas";
import * as StaticData from "@/lib/gameplay/coreData/static/staticData";
import * as StaticDataHelper from "@/lib/gameplay/coreData/static/staticDataHelpers";
import * as ThingType from "@/lib/gameplay/coreData/thing/thingTypes";
import * as ThingHelpers from "@/lib/gameplay/coreData/thing/thingHelpers";

const HOMEWORLD_PLANET_COUNT: number = 1;

//#region breakdown types
export type ValueSourceContribution =
{
    source: ThingType.SpecificThingType;
    ratePerHour: number;
};

export type ValueBonusContribution =
{
    label: string;
    percent: number;
    ratePerHourDelta: number;
};

export type CalculatedValueBreakdown =
{
    sourceContributions: ValueSourceContribution[];
    bonusContributions: ValueBonusContribution[];
    totalRatePerHour: number;
};
//#endregion

//#region shared aggregation primitives
function getCalculatedValueData<ValueType>(valueDatas: Map<ValueType, CoreType.CalculatedValueData>, valueType: ValueType): CoreType.CalculatedValueData | null
{
    const valueData: CoreType.CalculatedValueData | undefined = valueDatas.get(valueType);
    if (valueData === undefined)
    {
        return null;
    }

    return valueData;
}

function mergeCalculatedValueDatas<ValueType>(valueTypes: Iterable<ValueType>, sourceMaps: Map<ValueType, CoreType.CalculatedValueData>[]): Map<ValueType, CoreType.CalculatedValueData>
{
    const mergedValues: Map<ValueType, CoreType.CalculatedValueData> = new Map<ValueType, CoreType.CalculatedValueData>();

    for (const valueType of valueTypes)
    {
        for (const sourceMap of sourceMaps)
        {
            const valueData: CoreType.CalculatedValueData | undefined = sourceMap.get(valueType);
            if (valueData === undefined)
            {
                continue;
            }

            addCalculatedValueData(mergedValues, valueType, valueData);
        }
    }

    return mergedValues;
}

function addCalculatedValueData<ValueType>(valueDatas: Map<ValueType, CoreType.CalculatedValueData>, valueType: ValueType, valueData: CoreType.CalculatedValueData): void
{
    const currentValueData: CoreType.CalculatedValueData | undefined = valueDatas.get(valueType);
    if (currentValueData === undefined)
    {
        const initialValueData: CoreType.CalculatedValueData =
        {
            production: valueData.production,
            consumption: valueData.consumption,
        }
        valueDatas.set(valueType, initialValueData);
        return;
    }

    const newValueData: CoreType.CalculatedValueData =
    {
        production: currentValueData.production + valueData.production,
        consumption: currentValueData.consumption + valueData.consumption,
    }
    valueDatas.set(valueType, newValueData);
}

type CalculatedValueSourceContribution =
{
    source: ThingType.SpecificThingType;
    valueData: CoreType.CalculatedValueData;
};

function addCalculatedValueSourceContributions<ValueType>(sourceContributionsByType: Map<ValueType, CalculatedValueSourceContribution[]>, source: ThingType.SpecificThingType, values: Map<ValueType, CoreType.CalculatedValueData> | null): void
{
    if (values === null)
    {
        return;
    }

    for (const [valueType, valueData] of values)
    {
        if (valueData.production === 0 && valueData.consumption === 0)
        {
            continue;
        }

        const existingSourceContributions: CalculatedValueSourceContribution[] = sourceContributionsByType.get(valueType) ?? [];
        existingSourceContributions.push({ source: source, valueData: valueData });
        sourceContributionsByType.set(valueType, existingSourceContributions);
    }
}

function foldCalculatedValueSourceContributions<ValueType>(sourceContributionsByType: Map<ValueType, CalculatedValueSourceContribution[]>): Map<ValueType, CoreType.CalculatedValueData>
{
    const valueDatas: Map<ValueType, CoreType.CalculatedValueData> = new Map<ValueType, CoreType.CalculatedValueData>();

    for (const [valueType, sourceContributions] of sourceContributionsByType)
    {
        for (const sourceContribution of sourceContributions)
        {
            addCalculatedValueData(valueDatas, valueType, sourceContribution.valueData);
        }
    }

    return valueDatas;
}

function computeValueBreakdown(typeSourceContributions: CalculatedValueSourceContribution[]): CalculatedValueBreakdown
{
    const producingSourceContributions: ValueSourceContribution[] = [];
    const consumingSourceContributions: ValueSourceContribution[] = [];

    for (const typeSourceContribution of typeSourceContributions)
    {
        const signedRatePerHour: number = typeSourceContribution.valueData.production - typeSourceContribution.valueData.consumption;
        if (signedRatePerHour === 0)
        {
            continue;
        }

        const valueSourceContribution: ValueSourceContribution =
        {
            source: typeSourceContribution.source,
            ratePerHour: signedRatePerHour,
        };

        if (signedRatePerHour > 0)
        {
            producingSourceContributions.push(valueSourceContribution);
        }
        else
        {
            consumingSourceContributions.push(valueSourceContribution);
        }
    }

    const sourceContributions: ValueSourceContribution[] = [...producingSourceContributions, ...consumingSourceContributions];

    let totalRatePerHour: number = 0;
    for (const sourceContribution of sourceContributions)
    {
        totalRatePerHour += sourceContribution.ratePerHour;
    }

    const breakdown: CalculatedValueBreakdown =
    {
        sourceContributions: sourceContributions,
        bonusContributions: [],
        totalRatePerHour: totalRatePerHour,
    };

    return breakdown;
}
//#endregion

//#region planet values
type ResourceProductionThrottleContribution =
{
    planetValueType: GameType.PlanetValueType;
    displayName: string;
    ratio: number;
};

function computeResourceProductionThrottleContributions(planetData: CoreType.PlanetData, resourceType: GameType.ResourceType, playerData: CoreType.PlayerData): ResourceProductionThrottleContribution[]
{
    const throttleContributions: ResourceProductionThrottleContribution[] = [];

    for (const [planetValueType, planetValueInfo] of StaticData.PLANET_VALUE_INFOS)
    {
        if (planetValueInfo.ratioImpactsResourceProduction === undefined)
        {
            continue;
        }

        if (planetValueInfo.associatedResource !== undefined && planetValueInfo.associatedResource !== resourceType)
        {
            continue;
        }

        const planetValueData: CoreType.CalculatedValueData | null = computePlanetValueData(planetData, planetValueType, playerData);
        const resourceProductionRatio: number = computeProductionRatioFromPlanetValueData(planetValueData);

        const throttleContribution: ResourceProductionThrottleContribution =
        {
            planetValueType: planetValueType,
            displayName: planetValueInfo.displayName,
            ratio: resourceProductionRatio,
        };

        throttleContributions.push(throttleContribution);
    }

    return throttleContributions;
}

export function computeResourceProductionPlanetValueRatio(planetData: CoreType.PlanetData, resourceType: GameType.ResourceType, playerData: CoreType.PlayerData): number
{
    const throttleContributions: ResourceProductionThrottleContribution[] = computeResourceProductionThrottleContributions(planetData, resourceType, playerData);

    let totalRatio: number = 1;

    for (const throttleContribution of throttleContributions)
    {
        totalRatio *= throttleContribution.ratio;
    }

    return totalRatio;
}

export function computeResourceProductionBonusContributions(planetData: CoreType.PlanetData, resourceType: GameType.ResourceType, playerData: CoreType.PlayerData, baseRatePerHour: number): ValueBonusContribution[]
{
    const bonusContributions: ValueBonusContribution[] = [];

    const throttleContributions: ResourceProductionThrottleContribution[] = computeResourceProductionThrottleContributions(planetData, resourceType, playerData);

    let throttledRatePerHour: number = baseRatePerHour;

    for (const throttleContribution of throttleContributions)
    {
        if (throttleContribution.ratio === 1)
        {
            continue;
        }

        const ratePerHourDelta: number = throttledRatePerHour * (throttleContribution.ratio - 1);

        const bonusContribution: ValueBonusContribution =
        {
            label: throttleContribution.displayName,
            percent: (throttleContribution.ratio - 1) * 100,
            ratePerHourDelta: ratePerHourDelta,
        };

        bonusContributions.push(bonusContribution);
        throttledRatePerHour += ratePerHourDelta;
    }

    const modifierContributions: ResourceProductionModifierContribution[] = computeResourceProductionModifierContributions(playerData, resourceType);

    for (const modifierContribution of modifierContributions)
    {
        if (modifierContribution.percent === 0)
        {
            continue;
        }

        const bonusContribution: ValueBonusContribution =
        {
            label: modifierContribution.displayName,
            percent: modifierContribution.percent,
            ratePerHourDelta: throttledRatePerHour * (modifierContribution.percent / 100),
        };

        bonusContributions.push(bonusContribution);
    }

    return bonusContributions;
}

function computeProductionRatioFromPlanetValueData(planetValueData: CoreType.CalculatedValueData | null): number
{
    if (planetValueData === null)
    {
        return 1;
    }

    // No consumption means there is nothing throttling production, so the ratio is unconstrained.
    if (planetValueData.consumption === 0)
    {
        return 1;
    }

    return Math.min(1, planetValueData.production / planetValueData.consumption);
}

export function computeResourceMaximums(planetData: CoreType.PlanetData, playerData: CoreType.PlayerData): Map<GameType.ResourceType, number>
{
    const planetValuesMap: Map<GameType.PlanetValueType, CoreType.CalculatedValueData> = computePlanetValueDatas(planetData, playerData);
    const resourceMaximums: Map<GameType.ResourceType, number> = new Map<GameType.ResourceType, number>();

    for (const [planetValueType, planetValueInfo] of StaticData.PLANET_VALUE_INFOS)
    {
        if (planetValueInfo.limitsResourceMax === undefined)
        {
            continue;
        }

        if (planetValueInfo.associatedResource === undefined)
        {
            throw new Error(`Planet value ${planetValueType} has limitsResourceMax but no associatedResource.`);
        }

        const planetValue: CoreType.CalculatedValueData | undefined = planetValuesMap.get(planetValueType);
        if (planetValue === undefined)
        {
            continue;
        }

        const existingMaximum: number | undefined = resourceMaximums.get(planetValueInfo.associatedResource);

        if (existingMaximum === undefined || planetValue.production < existingMaximum)
        {
            resourceMaximums.set(planetValueInfo.associatedResource, planetValue.production);
        }
    }

    return resourceMaximums;
}

export function computePlanetValueData(planetData: CoreType.PlanetData, planetValueType: GameType.PlanetValueType, playerData: CoreType.PlayerData): CoreType.CalculatedValueData | null
{
    const planetValueDatas: Map<GameType.PlanetValueType, CoreType.CalculatedValueData> = computePlanetValueDatas(planetData, playerData);
    return getCalculatedValueData(planetValueDatas, planetValueType);
}

export function computePlanetValueNet(planetData: CoreType.PlanetData, planetValueType: GameType.PlanetValueType, playerData: CoreType.PlayerData): number
{
    const planetValueData: CoreType.CalculatedValueData | null = computePlanetValueData(planetData, planetValueType, playerData);
    if (planetValueData === null)
    {
        return 0;
    }

    return planetValueData.production - planetValueData.consumption;
}

export function computePlanetValueBreakdown(planetData: CoreType.PlanetData, planetValueType: GameType.PlanetValueType, playerData: CoreType.PlayerData): CalculatedValueBreakdown
{
    const sourceContributionsByType: Map<GameType.PlanetValueType, CalculatedValueSourceContribution[]> = computePlanetValueSourceContributions(planetData, playerData);
    const typeSourceContributions: CalculatedValueSourceContribution[] = sourceContributionsByType.get(planetValueType) ?? [];

    return computeValueBreakdown(typeSourceContributions);
}

function computePlanetValueSourceContributions(planetData: CoreType.PlanetData, playerData: CoreType.PlayerData): Map<GameType.PlanetValueType, CalculatedValueSourceContribution[]>
{
    const sourceContributionsByType: Map<GameType.PlanetValueType, CalculatedValueSourceContribution[]> = new Map<GameType.PlanetValueType, CalculatedValueSourceContribution[]>();

    const buildingTypes: GameType.BuildingType[] = StaticDataHelper.getAllSpecificThings(ThingType.Thing.Building);
    for (const buildingType of buildingTypes)
    {
        const buildingPlanetValues: Map<GameType.PlanetValueType, CoreType.CalculatedValueData> | null = PlanetValueProduction.computeBuildingPlanetValueProduction(buildingType, playerData, planetData);
        addCalculatedValueSourceContributions(sourceContributionsByType, ThingHelpers.building(buildingType), buildingPlanetValues);
    }

    const unitTypes: GameType.UnitType[] = StaticDataHelper.getAllSpecificThings(ThingType.Thing.Unit);
    for (const unitType of unitTypes)
    {
        const unitPlanetValues: Map<GameType.PlanetValueType, CoreType.CalculatedValueData> | null = PlanetValueProduction.computeUnitPlanetValueProduction(unitType, playerData, planetData);
        addCalculatedValueSourceContributions(sourceContributionsByType, ThingHelpers.unit(unitType), unitPlanetValues);
    }

    return sourceContributionsByType;
}

export function computePlanetValueDatas(planetData: CoreType.PlanetData, playerData: CoreType.PlayerData): Map<GameType.PlanetValueType, CoreType.CalculatedValueData>
{
    const sourceContributionsByType: Map<GameType.PlanetValueType, CalculatedValueSourceContribution[]> = computePlanetValueSourceContributions(planetData, playerData);

    const planetValueDataBySource: Map<GameType.PlanetValueType, CoreType.CalculatedValueData>[] =
    [
        computePlanetBaseValues(planetData),
        foldCalculatedValueSourceContributions(sourceContributionsByType),
    ];

    return mergeCalculatedValueDatas(StaticData.PLANET_VALUE_INFOS.keys(), planetValueDataBySource);
}

function computePlanetBaseValues(planetData: CoreType.PlanetData): Map<GameType.PlanetValueType, CoreType.CalculatedValueData>
{
    const baseValues: Map<GameType.PlanetValueType, CoreType.CalculatedValueData> = new Map<GameType.PlanetValueType, CoreType.CalculatedValueData>();

    baseValues.set(GameType.PlanetValueType.Size, { production: planetData.planetRow.size, consumption: 0 });
    baseValues.set(GameType.PlanetValueType.Temperature, { production: planetData.planetRow.temperature, consumption: 0 });

    return baseValues;
}

//#endregion

//#region player values
export function computePlayerValueData(playerData: CoreType.PlayerData, playerValueType: GameType.PlayerValueType): CoreType.CalculatedValueData | null
{
    const playerValueDatas: Map<GameType.PlayerValueType, CoreType.CalculatedValueData> = computePlayerValueDatas(playerData);
    return getCalculatedValueData(playerValueDatas, playerValueType);
}

export function computePlayerValueNet(playerData: CoreType.PlayerData, playerValueType: GameType.PlayerValueType): number
{
    const playerValueData: CoreType.CalculatedValueData | null = computePlayerValueData(playerData, playerValueType);
    if (playerValueData === null)
    {
        return 0;
    }

    return playerValueData.production - playerValueData.consumption;
}

export function computePlayerValueBreakdown(playerData: CoreType.PlayerData, playerValueType: GameType.PlayerValueType): CalculatedValueBreakdown
{
    const sourceContributionsByType: Map<GameType.PlayerValueType, CalculatedValueSourceContribution[]> = computePlayerValueSourceContributions(playerData);
    const typeSourceContributions: CalculatedValueSourceContribution[] = sourceContributionsByType.get(playerValueType) ?? [];

    return computeValueBreakdown(typeSourceContributions);
}

export function computeMaxOwnedPlanetCount(playerData: CoreType.PlayerData): number
{
    const colonySlots: number = computePlayerValueNet(playerData, GameType.PlayerValueType.ColonySlots);
    const astrophysicsPlanetAllowance: number = HOMEWORLD_PLANET_COUNT + colonySlots;

    return Math.max(StaticData.STARTING_OWNED_PLANET_COUNT, astrophysicsPlanetAllowance);
}

export function computeFreeColonyPlanetSlots(playerData: CoreType.PlayerData): number
{
    const maxOwnedPlanetCount: number = computeMaxOwnedPlanetCount(playerData);
    const ownedPlanetCount: number = CoreType.getOwnedPlanets(playerData.planetDatas).length;

    return maxOwnedPlanetCount - ownedPlanetCount;
}

type ResourceProductionModifierContribution =
{
    playerValueType: GameType.PlayerValueType;
    displayName: string;
    percent: number;
};

function computeResourceProductionModifierContributions(playerData: CoreType.PlayerData, resourceType: GameType.ResourceType): ResourceProductionModifierContribution[]
{
    const modifierContributions: ResourceProductionModifierContribution[] = [];

    for (const [playerValueType, playerValueInfo] of StaticData.PLAYER_VALUE_INFOS)
    {
        if (playerValueInfo.modifiesResourceProduction === undefined)
        {
            continue;
        }

        if (playerValueInfo.associatedResource !== undefined && playerValueInfo.associatedResource !== resourceType)
        {
            continue;
        }

        const modifierContribution: ResourceProductionModifierContribution =
        {
            playerValueType: playerValueType,
            displayName: playerValueInfo.displayName,
            percent: computePlayerValueNet(playerData, playerValueType),
        };

        modifierContributions.push(modifierContribution);
    }

    return modifierContributions;
}

export function computeResourceProductionModificationPercent(playerData: CoreType.PlayerData, resourceType: GameType.ResourceType): number
{
    const modifierContributions: ResourceProductionModifierContribution[] = computeResourceProductionModifierContributions(playerData, resourceType);

    let totalModificationPercent: number = 0;

    for (const modifierContribution of modifierContributions)
    {
        totalModificationPercent += modifierContribution.percent;
    }

    return totalModificationPercent;
}

export function computePlayerValueDatas(playerData: CoreType.PlayerData): Map<GameType.PlayerValueType, CoreType.CalculatedValueData>
{
    const sourceContributionsByType: Map<GameType.PlayerValueType, CalculatedValueSourceContribution[]> = computePlayerValueSourceContributions(playerData);

    return foldCalculatedValueSourceContributions(sourceContributionsByType);
}

function computePlayerValueSourceContributions(playerData: CoreType.PlayerData): Map<GameType.PlayerValueType, CalculatedValueSourceContribution[]>
{
    const sourceContributionsByType: Map<GameType.PlayerValueType, CalculatedValueSourceContribution[]> = new Map<GameType.PlayerValueType, CalculatedValueSourceContribution[]>();

    const buildingTypes: GameType.BuildingType[] = StaticDataHelper.getAllSpecificThings(ThingType.Thing.Building);
    for (const buildingType of buildingTypes)
    {
        const buildingPlayerValues: Map<GameType.PlayerValueType, CoreType.CalculatedValueData> | null = PlayerValueProduction.computeBuildingPlayerValueProduction(buildingType, playerData);
        addCalculatedValueSourceContributions(sourceContributionsByType, ThingHelpers.building(buildingType), buildingPlayerValues);
    }

    const unitTypes: GameType.UnitType[] = StaticDataHelper.getAllSpecificThings(ThingType.Thing.Unit);
    for (const unitType of unitTypes)
    {
        const unitPlayerValues: Map<GameType.PlayerValueType, CoreType.CalculatedValueData> | null = PlayerValueProduction.computeUnitPlayerValueProduction(unitType, playerData);
        addCalculatedValueSourceContributions(sourceContributionsByType, ThingHelpers.unit(unitType), unitPlayerValues);
    }

    const researchTypes: GameType.ResearchType[] = StaticDataHelper.getAllSpecificThings(ThingType.Thing.Research);
    for (const researchType of researchTypes)
    {
        const researchPlayerValues: Map<GameType.PlayerValueType, CoreType.CalculatedValueData> | null = PlayerValueProduction.computeResearchPlayerValueProduction(researchType, playerData);
        addCalculatedValueSourceContributions(sourceContributionsByType, ThingHelpers.research(researchType), researchPlayerValues);
    }

    return sourceContributionsByType;
}
//#endregion
