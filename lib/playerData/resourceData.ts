import * as AssociationMaps from "@/lib/gameplay/coreData/associationMaps";
import * as PlayerDataType from "@/lib/playerData/playerDataTypes";

// #region Resource Management
export function setResourceQuantity(fullPlanetData: PlayerDataType.FullPlanetData, resourceType: number, value: number): void
{
    const setter: PlayerDataType.TypeSetter | undefined = AssociationMaps.getTypeSetters(fullPlanetData, PlayerDataType.DataContext.ResourceQuantity).get(resourceType);

    if (!setter)
    {
        throw new Error("Resource quantities dont have setters.");
        return;
    }

    setter(value);
}

export function setResourceQuantities(fullPlanetData: PlayerDataType.FullPlanetData, resourceQuantities: Map<number, number>): void
{
    for (const [resourceType, resourceQuantity] of resourceQuantities)
    {
        setResourceQuantity(fullPlanetData, resourceType, resourceQuantity);
    }
}

export function getResourceQuantity(fullPlanetData: PlayerDataType.FullPlanetData, resourceType: number): number
{
    const getter: PlayerDataType.TypeGetter | undefined = AssociationMaps.getTypeGetters(fullPlanetData, PlayerDataType.DataContext.ResourceQuantity).get(resourceType);

    if (!getter)
    {
        throw new Error("Building levels dont have Getters.");
        return 0;
    }

    return getter();
}
//#endregion