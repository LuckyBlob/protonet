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
export function computeResourceProductionPlanetValueRatio(planetData: CoreType.PlanetData, resourceType: GameType.ResourceType, playerData: CoreType.PlayerData): number
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

        const planetValueData: CoreType.CalculatedValueData | null = computePlanetValueData(planetData, planetValueType, playerData);
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

export function computePlanetValueDatas(planetData: CoreType.PlanetData, playerData: CoreType.PlayerData): Map<GameType.PlanetValueType, CoreType.CalculatedValueData>
{
    const planetValueDataBySource: Map<GameType.PlanetValueType, CoreType.CalculatedValueData>[] =
    [
        computePlanetBaseValues(planetData),
        computeBuildingPlanetValueDatas(planetData, playerData),
        computeUnitPlanetValueDatas(planetData, playerData),
        computeResearchPlanetValueDatas(planetData),
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

function computeUnitPlanetValueDatas(planetData: CoreType.PlanetData, playerData: CoreType.PlayerData): Map<GameType.PlanetValueType, CoreType.CalculatedValueData>
{
    const newUnitPlanetValues: Map<GameType.PlanetValueType, CoreType.CalculatedValueData> = new Map<GameType.PlanetValueType, CoreType.CalculatedValueData>();

    const unitTypes: GameType.UnitType[] = StaticDataHelper.getAllSpecificThings(ThingType.Thing.Unit);
    for (const unitType of unitTypes)
    {
        const unitPlanetValues: Map<GameType.PlanetValueType, CoreType.CalculatedValueData> | null = PlanetValueProduction.computeUnitPlanetValueProduction(unitType, playerData, planetData);
        if (unitPlanetValues === null)
        {
            continue;
        }

        for (const [planetValueType, planetValueAmounts] of unitPlanetValues)
        {
            addCalculatedValueData(newUnitPlanetValues, planetValueType, planetValueAmounts);
        }
    }

    return newUnitPlanetValues;
}

function computeResearchPlanetValueDatas(planetData: CoreType.PlanetData): Map<GameType.PlanetValueType, CoreType.CalculatedValueData>
{
    const newResearchPlanetValues: Map<GameType.PlanetValueType, CoreType.CalculatedValueData> = new Map<GameType.PlanetValueType, CoreType.CalculatedValueData>();

    return newResearchPlanetValues;
}

function computeBuildingPlanetValueDatas(planetData: CoreType.PlanetData, playerData: CoreType.PlayerData): Map<GameType.PlanetValueType, CoreType.CalculatedValueData>
{
    const newBuildingPlanetValues: Map<GameType.PlanetValueType, CoreType.CalculatedValueData> = new Map<GameType.PlanetValueType, CoreType.CalculatedValueData>();

    const buildingTypes: GameType.BuildingType[] = StaticDataHelper.getAllSpecificThings(ThingType.Thing.Building)
    for (const buildingType of buildingTypes)
    {
        const buildingPlanetValues: Map<GameType.PlanetValueType, CoreType.CalculatedValueData> = PlanetValueProduction.computeBuildingPlanetValueProduction(buildingType, playerData, planetData) ?? new Map<GameType.PlanetValueType, CoreType.CalculatedValueData>();

        for (const [planetValueType, planetValueAmounts] of buildingPlanetValues)
        {
            addCalculatedValueData(newBuildingPlanetValues, planetValueType, planetValueAmounts);
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

export function computePlayerValueNet(playerData: CoreType.PlayerData, playerValueType: GameType.PlayerValueType): number
{
    const playerValueData: CoreType.CalculatedValueData | null = computePlayerValueData(playerData, playerValueType);
    if (playerValueData === null)
    {
        return 0;
    }

    return playerValueData.production - playerValueData.consumption;
}

export function computeResourceProductionModificationPercent(playerData: CoreType.PlayerData, resourceType: GameType.ResourceType): number
{
    let totalModificationPercent: number = 0;

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

        totalModificationPercent += computePlayerValueNet(playerData, playerValueType);
    }

    return totalModificationPercent;
}

export function computePlayerValueDatas(playerData: CoreType.PlayerData): Map<GameType.PlayerValueType, CoreType.CalculatedValueData>
{
    const playerValueDataBySource: Map<GameType.PlayerValueType, CoreType.CalculatedValueData>[] =
    [
        computeBuildingPlayerValueDatas(playerData),
        computeUnitPlayerValueDatas(playerData),
        computeResearchPlayerValueDatas(playerData),
    ];

    return mergeCalculatedValueDatas(StaticData.PLAYER_VALUE_INFOS.keys(), playerValueDataBySource);
}

function computeBuildingPlayerValueDatas(playerData: CoreType.PlayerData): Map<GameType.PlayerValueType, CoreType.CalculatedValueData>
{
    const newBuildingPlayerValues: Map<GameType.PlayerValueType, CoreType.CalculatedValueData> = new Map<GameType.PlayerValueType, CoreType.CalculatedValueData>();

    const buildingTypes: GameType.BuildingType[] = StaticDataHelper.getAllSpecificThings(ThingType.Thing.Building);
    for (const buildingType of buildingTypes)
    {
        const buildingPlayerValues: Map<GameType.PlayerValueType, CoreType.CalculatedValueData> | null = PlayerValueProduction.computeBuildingPlayerValueProduction(buildingType, playerData);
        if (buildingPlayerValues === null)
        {
            continue;
        }

        for (const [playerValueType, playerValueAmounts] of buildingPlayerValues)
        {
            addCalculatedValueData(newBuildingPlayerValues, playerValueType, playerValueAmounts);
        }
    }

    return newBuildingPlayerValues;
}

function computeUnitPlayerValueDatas(playerData: CoreType.PlayerData): Map<GameType.PlayerValueType, CoreType.CalculatedValueData>
{
    const newUnitPlayerValues: Map<GameType.PlayerValueType, CoreType.CalculatedValueData> = new Map<GameType.PlayerValueType, CoreType.CalculatedValueData>();

    const unitTypes: GameType.UnitType[] = StaticDataHelper.getAllSpecificThings(ThingType.Thing.Unit);
    for (const unitType of unitTypes)
    {
        const unitPlayerValues: Map<GameType.PlayerValueType, CoreType.CalculatedValueData> | null = PlayerValueProduction.computeUnitPlayerValueProduction(unitType, playerData);
        if (unitPlayerValues === null)
        {
            continue;
        }

        for (const [playerValueType, playerValueAmounts] of unitPlayerValues)
        {
            addCalculatedValueData(newUnitPlayerValues, playerValueType, playerValueAmounts);
        }
    }

    return newUnitPlayerValues;
}

function computeResearchPlayerValueDatas(playerData: CoreType.PlayerData): Map<GameType.PlayerValueType, CoreType.CalculatedValueData>
{
    const newResearchPlayerValues: Map<GameType.PlayerValueType, CoreType.CalculatedValueData> = new Map<GameType.PlayerValueType, CoreType.CalculatedValueData>();

    const researchTypes: GameType.ResearchType[] = StaticDataHelper.getAllSpecificThings(ThingType.Thing.Research);
    for (const researchType of researchTypes)
    {
        const researchPlayerValues: Map<GameType.PlayerValueType, CoreType.CalculatedValueData> | null = PlayerValueProduction.computeResearchPlayerValueProduction(researchType, playerData);

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
