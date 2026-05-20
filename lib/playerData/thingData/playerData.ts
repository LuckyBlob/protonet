import * as PlayerDataType from "@/lib/playerData/playerDataTypes";
import * as AssociationMaps from "@/lib/gameplay/coreData/associationMaps";
import * as BuildingData from "@/lib/playerData/thingData/buildingData";
import * as ShipData from "@/lib/playerData/thingData/shipData";
import * as PlayerData from "@/lib/playerData/thingData/playerData";

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
    if (planetId !== null)
    {
        const matchingPlanet: PlayerDataType.FullPlanetData | undefined = fullPlanetDatas.find((fullPlanetData: PlayerDataType.FullPlanetData) =>
        {
            return fullPlanetData.planetRow.id === planetId;
        });

        if (matchingPlanet !== undefined)
        {
            return matchingPlanet
        }
    }

    return null
}

export function hasThing(playerData: PlayerDataType.PlayerData, specificThing: AssociationMaps.SpecificThingType, value: number, planetId: number | null): boolean
{
    switch (specificThing.thingType)
    {
        case AssociationMaps.ThingType.Building:
        {
            if (planetId == null)
            {
                return false;
            }
            const fullPlanetData: PlayerDataType.FullPlanetData | null = PlayerData.getFullPlanetDataForId(playerData.fullPlanetDatas, planetId);
            if (fullPlanetData === null)
            {
                return false;
            }
            return BuildingData.hasBuilding(fullPlanetData, specificThing.specificThingType, value);
        }
    }

	return false;
}

export function meetsShipBuildRequirements(playerData: PlayerDataType.PlayerData, shipType: number, planetId: number): boolean
{
	return meetsRequirementsInternal(playerData, AssociationMaps.ship(shipType), planetId);
}
export function meetsBuildingUpgradeRequirements(playerData: PlayerDataType.PlayerData, buildingType: number, planetId: number): boolean
{
	return meetsRequirementsInternal(playerData, AssociationMaps.building(buildingType), planetId);
}
export function getShipRequirementDescriptions(shipType: number): string[]
{
	return getRequirementDescriptionsInternal(AssociationMaps.ship(shipType));
}
export function getBuildingRequirementDescriptions(buildingType: number): string[]
{
	return getRequirementDescriptionsInternal(AssociationMaps.building(buildingType));
}
function hasRequirements(specificThingType: AssociationMaps.SpecificThingType): AssociationMaps.ThingRequirement[] | null
{
    const thingTypeRequirements: ReadonlyMap<number, AssociationMaps.ThingRequirement[]> | undefined = AssociationMaps.THING_REQUIREMENT.get(specificThingType.thingType);
    if (thingTypeRequirements === undefined)
    {
        // no thing requirements at all
        return null;
    }

    const thingRequirements: AssociationMaps.ThingRequirement[] | undefined = thingTypeRequirements.get(specificThingType.specificThingType);
    if (thingRequirements === undefined)
    {
        // no requirements for this specific thing
        return null;
    }
    return thingRequirements;
}

function meetsRequirementsInternal(playerData: PlayerDataType.PlayerData, specificThingType: AssociationMaps.SpecificThingType, planetId: number | null): boolean
{
    const thingRequirements: AssociationMaps.ThingRequirement[] | null = hasRequirements(specificThingType);
    if (thingRequirements === null)
    {
        return true;
    }

    for (const thingRequirement of thingRequirements)
    {
        if (!hasThing(playerData, thingRequirement.specificThingType, thingRequirement.value, planetId))
        {
            // you dont have a specific thing you need
            return false;
        }
    }

    return true;
}

function getRequirementDescriptionsInternal(specificThingType: AssociationMaps.SpecificThingType): string[]
{
    const thingRequirements: AssociationMaps.ThingRequirement[] | null = hasRequirements(specificThingType);
    if (thingRequirements === null)
    {
        return [];
    }

    const descriptions: string[] = [];
	for (const thingRequirement of thingRequirements)
	{
		const requiredThing: AssociationMaps.SpecificThingType = thingRequirement.specificThingType;
		const requiredValue: number = thingRequirement.value;
		const thingName: string = AssociationMaps.getThingName(requiredThing);

		descriptions.push(`Requires ${thingName} at ${requiredValue}`);
	}

	return descriptions;
}