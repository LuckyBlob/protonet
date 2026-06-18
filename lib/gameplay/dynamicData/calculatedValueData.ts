// Calculated value data: planet values (energy, storage) and player values (fleet slots).
// Planet and player values share the same data shape and aggregation logic and differ only in their
// sources (buildings/ships/research) and the value-type domain they range over, so they live together
// here with the merge + accumulate primitives parameterized over the value-type key.
import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as BuildingPlanetValueProduction from "@/lib/gameplay/coreData/formula/buildingPlanetValueProductionFormulas";
import * as ResearchPlayerValueProduction from "@/lib/gameplay/coreData/formula/researchPlayerValueProductionFormulas";
import * as StaticData from "@/lib/gameplay/coreData/static/staticData";
import * as StaticDataHelper from "@/lib/gameplay/coreData/static/staticDataHelpers";
import * as ThingType from "@/lib/gameplay/coreData/thing/thingTypes";
import * as BuildingData from "@/lib/gameplay/dynamicData/planet/buildingData";
import * as BuildingEnergySetting from "@/lib/gameplay/dynamicData/planet/buildingEnergySettingData";
import * as ResearchData from "@/lib/gameplay/dynamicData/player/researchData";

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
//#endregion

//#region planet values
export function computeResourceProductionPlanetValueRatio(planetData: CoreType.PlanetData, resourceType: GameType.ResourceType): number
{
    let totalRatio: number = 1;

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

        const planetValueData: CoreType.CalculatedValueData | null = computePlanetValueData(planetData, planetValueType);
        const resourceProductionRatio: number = computeProductionRatioFromPlanetValueData(planetValueData);

        totalRatio *= resourceProductionRatio;
    }

    return totalRatio;
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

export function computeResourceMaximums(planetData: CoreType.PlanetData): Map<GameType.ResourceType, number>
{
    const planetValuesMap: Map<GameType.PlanetValueType, CoreType.CalculatedValueData> = computePlanetValueDatas(planetData);
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

export function computePlanetValueData(planetData: CoreType.PlanetData, planetValueType: GameType.PlanetValueType): CoreType.CalculatedValueData | null
{
    const planetValueDatas: Map<GameType.PlanetValueType, CoreType.CalculatedValueData> = computePlanetValueDatas(planetData);
    return getCalculatedValueData(planetValueDatas, planetValueType);
}

export function computePlanetValueDatas(planetData: CoreType.PlanetData): Map<GameType.PlanetValueType, CoreType.CalculatedValueData>
{
    const planetValueDataBySource: Map<GameType.PlanetValueType, CoreType.CalculatedValueData>[] =
    [
        computeBuildingPlanetValueDatas(planetData),
        computeShipPlanetValueDatas(planetData),
        computeResearchPlanetValueDatas(planetData),
    ];

    return mergeCalculatedValueDatas(StaticData.PLANET_VALUE_INFOS.keys(), planetValueDataBySource);
}

function computeShipPlanetValueDatas(planetData: CoreType.PlanetData): Map<GameType.PlanetValueType, CoreType.CalculatedValueData>
{
    const newShipPlanetValues: Map<GameType.PlanetValueType, CoreType.CalculatedValueData> = new Map<GameType.PlanetValueType, CoreType.CalculatedValueData>();

    return newShipPlanetValues;
}

function computeResearchPlanetValueDatas(planetData: CoreType.PlanetData): Map<GameType.PlanetValueType, CoreType.CalculatedValueData>
{
    const newResearchPlanetValues: Map<GameType.PlanetValueType, CoreType.CalculatedValueData> = new Map<GameType.PlanetValueType, CoreType.CalculatedValueData>();

    return newResearchPlanetValues;
}

function computeBuildingPlanetValueDatas(planetData: CoreType.PlanetData): Map<GameType.PlanetValueType, CoreType.CalculatedValueData>
{
    const newBuildingPlanetValues: Map<GameType.PlanetValueType, CoreType.CalculatedValueData> = new Map<GameType.PlanetValueType, CoreType.CalculatedValueData>();

    const buildingTypes: GameType.BuildingType[] = StaticDataHelper.getAllSpecificThings(ThingType.Thing.Building)
    for (const buildingType of buildingTypes)
    {
        const buildingLevel: number = BuildingData.getBuildingLevel(planetData, buildingType);
        const buildingPlanetValues: Map<GameType.PlanetValueType, CoreType.CalculatedValueData> | null = BuildingPlanetValueProduction.computeBuildingPlanetValueProduction(buildingLevel, buildingType);

        if (buildingPlanetValues === null)
        {
            continue;
        }

        const energyFactor: number = BuildingEnergySetting.getBuildingEnergyFactor(planetData, buildingType);

        for (const [planetValueType, planetValueAmounts] of buildingPlanetValues)
        {
            // The per-building energy throttle scales only the Energy contribution (both producers
            // and consumers); storage planet values are unaffected.
            const scaledPlanetValueAmounts: CoreType.CalculatedValueData = planetValueType === GameType.PlanetValueType.Energy
                ? { production: planetValueAmounts.production * energyFactor, consumption: planetValueAmounts.consumption * energyFactor }
                : planetValueAmounts;

            addCalculatedValueData(newBuildingPlanetValues, planetValueType, scaledPlanetValueAmounts);
        }
    }

    return newBuildingPlanetValues;
}
//#endregion

//#region player values
export function computePlayerValueData(playerData: CoreType.PlayerData, playerValueType: GameType.PlayerValueType): CoreType.CalculatedValueData | null
{
    const playerValueDatas: Map<GameType.PlayerValueType, CoreType.CalculatedValueData> = computePlayerValueDatas(playerData);
    return getCalculatedValueData(playerValueDatas, playerValueType);
}

export function computePlayerValueDatas(playerData: CoreType.PlayerData): Map<GameType.PlayerValueType, CoreType.CalculatedValueData>
{
    const playerValueDataBySource: Map<GameType.PlayerValueType, CoreType.CalculatedValueData>[] =
    [
        computeBuildingPlayerValueDatas(playerData),
        computeShipPlayerValueDatas(playerData),
        computeResearchPlayerValueDatas(playerData),
    ];

    return mergeCalculatedValueDatas(StaticData.PLAYER_VALUE_INFOS.keys(), playerValueDataBySource);
}

function computeBuildingPlayerValueDatas(playerData: CoreType.PlayerData): Map<GameType.PlayerValueType, CoreType.CalculatedValueData>
{
    const newBuildingPlayerValues: Map<GameType.PlayerValueType, CoreType.CalculatedValueData> = new Map<GameType.PlayerValueType, CoreType.CalculatedValueData>();

    return newBuildingPlayerValues;
}

function computeShipPlayerValueDatas(playerData: CoreType.PlayerData): Map<GameType.PlayerValueType, CoreType.CalculatedValueData>
{
    const newShipPlayerValues: Map<GameType.PlayerValueType, CoreType.CalculatedValueData> = new Map<GameType.PlayerValueType, CoreType.CalculatedValueData>();

    return newShipPlayerValues;
}

function computeResearchPlayerValueDatas(playerData: CoreType.PlayerData): Map<GameType.PlayerValueType, CoreType.CalculatedValueData>
{
    const newResearchPlayerValues: Map<GameType.PlayerValueType, CoreType.CalculatedValueData> = new Map<GameType.PlayerValueType, CoreType.CalculatedValueData>();

    const researchTypes: GameType.ResearchType[] = StaticDataHelper.getAllSpecificThings(ThingType.Thing.Research);
    for (const researchType of researchTypes)
    {
        const researchLevel: number = ResearchData.getResearchLevel(playerData, researchType);
        const researchPlayerValues: Map<GameType.PlayerValueType, CoreType.CalculatedValueData> | null = ResearchPlayerValueProduction.computeResearchPlayerValueProduction(researchLevel, researchType);

        if (researchPlayerValues === null)
        {
            continue;
        }

        for (const [playerValueType, playerValueAmounts] of researchPlayerValues)
        {
            addCalculatedValueData(newResearchPlayerValues, playerValueType, playerValueAmounts);
        }
    }

    return newResearchPlayerValues;
}
//#endregion
