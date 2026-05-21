import * as PlayerDataType from "@/lib/gameplay/gameplayData/player/playerDataTypes";

export function getVariableFromContext<T extends PlayerDataType.DataContext>(data: PlayerDataType.DynamicPlanetData, variable: T): PlayerDataType.DynamicPlanetData[typeof PlayerDataType.DataContextToVariableNameMap[T]]
{
	const propertyKey: typeof PlayerDataType.DataContextToVariableNameMap[T] = PlayerDataType.DataContextToVariableNameMap[variable];
    
    if (propertyKey === undefined)
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