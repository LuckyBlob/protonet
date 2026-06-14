import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as ThingType from "@/lib/gameplay/coreData/type/thingTypes"
import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as BuildingPlanetValueProduction from "@/lib/gameplay/coreData/formula/buildingPlanetValueProductionFormulas";
import * as StaticData from "@/lib/gameplay/coreData/static/staticData";

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

        const planetValueData: CoreType.PlanetValueData | null = computePlanetValueData(planetData, planetValueType);
        const resourceProductionRatio: number = computeProductionRatioFromPlanetValueData(planetValueData);

        totalRatio *= resourceProductionRatio;
    }

    return totalRatio;
}

function computeProductionRatioFromPlanetValueData(planetValueData: CoreType.PlanetValueData | null): number
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

export function computePlanetValueData(planetData: CoreType.PlanetData, planetValueType: GameType.PlanetValueType): CoreType.PlanetValueData | null
{
    const planetValueDatas:  Map<GameType.PlanetValueType, CoreType.PlanetValueData> = computePlanetValueDatas(planetData.dynamicPlanetData);
    const planetValueData: CoreType.PlanetValueData | undefined = planetValueDatas.get(planetValueType);
    if (planetValueData === undefined)
    {
        return null;
    }

    return planetValueData;
}

export function computePlanetValueDatas(data: CoreType.DynamicPlanetData): Map<GameType.PlanetValueType, CoreType.PlanetValueData>
{
    const newPlanetValues: Map<GameType.PlanetValueType, CoreType.PlanetValueData> = new Map<GameType.PlanetValueType, CoreType.PlanetValueData>();

    const planetValueDataBySource: Map<GameType.PlanetValueType, CoreType.PlanetValueData>[] =
    [
        computeBuildingPlanetValueDatas(data),
        computeShipPlanetValueDatas(data)
    ];

    for (const planetValueType of StaticData.PLANET_VALUE_INFOS.keys())
    {
        for (const sourceMap of planetValueDataBySource)
        {
            const planetValueData: CoreType.PlanetValueData | undefined = sourceMap.get(planetValueType);
            if (planetValueData === undefined)
            {
                continue;
            }

            const currentValueData: CoreType.PlanetValueData | undefined = newPlanetValues.get(planetValueType);
            if (currentValueData === undefined)
            {
                newPlanetValues.set(planetValueType, planetValueData);
            }
            else
            {
                currentValueData.production += planetValueData.production;
                currentValueData.consumption += planetValueData.consumption;
            }
        }
    }

    return newPlanetValues;
}

function computeShipPlanetValueDatas(data: CoreType.DynamicPlanetData): Map<GameType.PlanetValueType, CoreType.PlanetValueData>
{
    const newShipPlanetValues: Map<GameType.PlanetValueType, CoreType.PlanetValueData> = new Map<GameType.PlanetValueType, CoreType.PlanetValueData>();

    return newShipPlanetValues;
}

function computeBuildingPlanetValueDatas(data: CoreType.DynamicPlanetData): Map<GameType.PlanetValueType, CoreType.PlanetValueData>
{
    const newBuildingPlanetValues: Map<GameType.PlanetValueType, CoreType.PlanetValueData> = new Map<GameType.PlanetValueType, CoreType.PlanetValueData>();

    for (const [buildingType, buildingLevel] of data.buildingLevels)
    {
        const buildingPlanetValues: Map<GameType.PlanetValueType, CoreType.PlanetValueData> | null = BuildingPlanetValueProduction.computeBuildingPlanetValueProduction(buildingLevel, buildingType);

        if (buildingPlanetValues === null)
        {
            continue;
        }

        for (const [planetValueType, planetValueAmounts] of buildingPlanetValues)
        {
            const currentPlanetValueFromBuilding: CoreType.PlanetValueData | undefined = newBuildingPlanetValues.get(planetValueType);
            if (currentPlanetValueFromBuilding === undefined)
            {
                newBuildingPlanetValues.set(planetValueType, planetValueAmounts);
            }
            else
            {
                const newPlanetValues: CoreType.PlanetValueData =
                {
                    production: currentPlanetValueFromBuilding.production + planetValueAmounts.production,
                    consumption: currentPlanetValueFromBuilding.consumption + planetValueAmounts.consumption,
                }
                newBuildingPlanetValues.set(planetValueType, newPlanetValues);
            }
        }
    }

    return newBuildingPlanetValues;
}