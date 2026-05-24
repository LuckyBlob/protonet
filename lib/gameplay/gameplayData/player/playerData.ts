import * as PlayerDataType from "@/lib/gameplay/gameplayData/player/playerDataTypes";

type VariableNameMapType = typeof PlayerDataType.DataContextToVariableNameMap;
type TargetPropertyName<T extends PlayerDataType.DataContext> = Extract<VariableNameMapType[T], keyof PlayerDataType.DynamicPlanetData>;
export function getVariableFromContext<T extends PlayerDataType.DataContext>(data: PlayerDataType.DynamicPlanetData, variable: T): PlayerDataType.DynamicPlanetData[TargetPropertyName<T>]
{
    const propertyKey: TargetPropertyName<T> = PlayerDataType.DataContextToVariableNameMap[variable] as TargetPropertyName<T>;
    
    if (propertyKey === undefined)
    {
        throw new Error(`UNREACHABLE: Mismatch DynamicPlanetData: fill DataContext and DataContextToVariableNameMap.`);
    }

    // 3. This will now compile cleanly because TargetPropertyName<T> is guaranteed to be a valid key
    return data[propertyKey] as PlayerDataType.DynamicPlanetData[TargetPropertyName<T>];
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