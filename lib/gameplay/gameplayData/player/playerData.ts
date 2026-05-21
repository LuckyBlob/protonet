import * as PlayerDataType from "@/lib/gameplay/gameplayData/player/playerDataTypes";
import * as BuildingData from "@/lib/gameplay/gameplayData/dynamic/buildingData";
import * as ShipData from "@/lib/gameplay/gameplayData/dynamic/shipData";
import * as PlayerData from "@/lib/gameplay/gameplayData/player/playerData";
import * as ThingType from "@/lib/gameplay/coreData/type/thingTypes";
import * as RequirementType from "@/lib/gameplay/coreData/requirement/requirementTypes"
import * as Requirement from "@/lib/gameplay/coreData/requirement/requirements"

export function getVariableFromContext<T extends PlayerDataType.DataContext>(data: PlayerDataType.DynamicPlanetData, variable: T): PlayerDataType.DynamicPlanetData[typeof PlayerDataType.DataContextToVariableNameMap[T]]
{
	const propertyKey = PlayerDataType.DataContextToVariableNameMap[variable];
    
    if (!propertyKey)
	{
        throw new Error(`UNREACHABLE: Mismatch DynamicPlanetData: fill DataContext and DataContextToVariableNameMap.`);
    }

    return data[propertyKey] as PlayerDataType.DynamicPlanetData[typeof PlayerDataType.DataContextToVariableNameMap[T]];
}

export function getDataContexts(): PlayerDataType.DataContext[]
{
	return Object.values(PlayerDataType.DataContext) as PlayerDataType.DataContext[];
}

export function getFullPlanetDataForId(fullPlanetDatas: PlayerDataType.FullPlanetData[], planetId: number): PlayerDataType.FullPlanetData | null
{
    const matchingPlanet: PlayerDataType.FullPlanetData | undefined = fullPlanetDatas.find((fullPlanetData: PlayerDataType.FullPlanetData) =>
    {
        return fullPlanetData.planetRow.id === planetId;
    });

    if (matchingPlanet !== undefined)
    {
        return matchingPlanet
    }

    return null
}