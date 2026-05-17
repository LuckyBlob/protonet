import * as DBType from "@/lib/db/dbTypes";
import * as AssociationMaps from "@/lib/gameplay/coreData/associationMaps";
import * as BuildingDurationFormulas from "@/lib/gameplay/coreData/buildingDurationFormulas";
import * as ServerDataType from "@/lib/serverData/serverDataTypes";
import * as BuildingProductionFormulas from "@/lib/gameplay/coreData/buildingProductionFormulas";

export type DynamicPlanetData =
{
	ressourceQuantity: Map<number, number>;
	buildingLevels: Map<number, number>;
};
export const EmptyPlanetData: DynamicPlanetData =
{
	ressourceQuantity: new Map<number, number>(),
	buildingLevels: new Map<number, number>(),
};
export type FullPlanetData =
{
	planetRow: DBType.PlanetRow;
	dynamicPlanetData: DynamicPlanetData;
};

type numberRowValueAccessor =
{
    get: () => number;
    set: (value: number) => void;
};

export function setRessourceQuantity(fullPlanetData: FullPlanetData, ressourceType: number, value: number): void
{
    const accessorMap: Map<number, numberRowValueAccessor> = getRessourceAccessorMap(fullPlanetData);
    const accessor: numberRowValueAccessor | undefined = accessorMap.get(ressourceType);

    if (accessor === undefined)
    {
        return;
    }

    accessor.set(value);
}

export function getRessourceQuantity(fullPlanetData: FullPlanetData, ressourceType: number): number | null
{
    const currentRessourceMap: Map<number, number> = getRessourceQuantityMap(fullPlanetData);
    const ressourceQuantity: number | undefined = currentRessourceMap.get(ressourceType);
    if (ressourceQuantity === undefined)
    {
        return null;
    }

    return ressourceQuantity;
}

export function getRessourceQuantityMap(fullPlanetData: FullPlanetData): Map<number, number>
{
    const accessorMap: Map<number, numberRowValueAccessor> = getRessourceAccessorMap(fullPlanetData);
    const quantityMap: Map<number, number> = new Map<number, number>();

    for (const [ressourceType, accessor] of accessorMap)
    {
        quantityMap.set(ressourceType, accessor.get());
    }

    return quantityMap;
}

function getRessourceAccessorMap(fullPlanetData: FullPlanetData): Map<number, numberRowValueAccessor>
{
    const ressourceAccessorMap: Map<number, numberRowValueAccessor> = new Map([]);
    for (const [ressourceType, ressourceName] of AssociationMaps.RESSOURCE_DISPLAY_NAMES)
    {
        ressourceAccessorMap.set(ressourceType,
        {
            get: (): number => fullPlanetData.dynamicPlanetData.ressourceQuantity.get(ressourceType)!,
            set: (value: number): void => { fullPlanetData.dynamicPlanetData.ressourceQuantity.set(ressourceType, value); },
        });
    }
    return ressourceAccessorMap;
}

export function setBuildingLevel(fullPlanetData: FullPlanetData, buildingType: number, value: number): void
{
    const accessorMap: Map<number, numberRowValueAccessor> = getBuildingLevelAccessorMap(fullPlanetData);
    const accessor: numberRowValueAccessor | undefined = accessorMap.get(buildingType);

    if (accessor === undefined)
    {
        return;
    }

    accessor.set(value);
}

export function getBuildingLevel(fullPlanetData: FullPlanetData, buildingType: number): number | null
{
    const buildingLevelMap: Map<number, number> = getBuildingLevelMap(fullPlanetData);
    const buildingLevel: number | undefined = buildingLevelMap.get(buildingType);
    if (buildingLevel === undefined)
    {

        return null;
    }

    return buildingLevel;
}

export function getBuildingLevelMap(fullPlanetData: FullPlanetData): Map<number, number>
{
    const accessorMap: Map<number, numberRowValueAccessor> = getBuildingLevelAccessorMap(fullPlanetData);
    const buildingLevelMap: Map<number, number> = new Map<number, number>();

    for (const [buildingType, accessor] of accessorMap)
    {
        buildingLevelMap.set(buildingType, accessor.get());
    }

    return buildingLevelMap;
}

function getBuildingLevelAccessorMap(fullPlanetData: FullPlanetData): Map<number, numberRowValueAccessor>
{
    const buildingLevelAccessorMap: Map<number, numberRowValueAccessor> = new Map([]);
    for (const [ressourceType, ressourceName] of AssociationMaps.BUILDING_DISPLAY_NAMES)
    {
        buildingLevelAccessorMap.set(ressourceType,
        {
            get: (): number => fullPlanetData.dynamicPlanetData.buildingLevels.get(ressourceType)!,
            set: (value: number): void => { fullPlanetData.dynamicPlanetData.buildingLevels.set(ressourceType, value); },
        });
    }
    return buildingLevelAccessorMap;
}

export function getBuildingUpgradeDurationSeconds(fullPlanetData: FullPlanetData, serverData: ServerDataType.ServerData, buildingType: number): number | null
{
    const upgradeDurationSecondsFunction: ((currentUpgradeLevel: number, buildingType: number, serverData: ServerDataType.ServerData | null) => number) | undefined = BuildingDurationFormulas.buildingUpgradeDurationSecondsFunctionMap.get(buildingType);
    if (upgradeDurationSecondsFunction === undefined)
    {
        return null;
    }
    
	const currentBuildingUpgradeLevel: number | null = getBuildingLevel(fullPlanetData, buildingType);
	if (currentBuildingUpgradeLevel === null)
	{
        return null;
    }

    return upgradeDurationSecondsFunction(currentBuildingUpgradeLevel, buildingType,serverData);
}

export function isProductionBuilding(buildingType: number): boolean
{
    return BuildingProductionFormulas.buildingProductionPerHoursFunctionMap.get(buildingType) !== undefined;
}

export function getProductionBuildingTypes(): number[]
{
	const productionBuildingTypeArray: number[] = [];

	for (const [buildingType, productionFunction] of BuildingProductionFormulas.buildingProductionPerHoursFunctionMap)
	{
		productionBuildingTypeArray.push(buildingType);
	}

	return productionBuildingTypeArray;
}

// Could have more than a single type of building producing a ressource
export function getProductionBuildingTypeArrayForRessourceType(ressourceType: number): number[]
{
	const productionBuildingTypeArray: number[] = [];

	for (const [buildingType, productionFunction] of BuildingProductionFormulas.buildingProductionPerHoursFunctionMap)
	{
		const productionMap: Map<number, number> = productionFunction(1, null);

		if (productionMap.has(ressourceType) === true)
		{
			productionBuildingTypeArray.push(buildingType);
		}
	}

	return productionBuildingTypeArray;
}

export function doesBuildingProduceRessource(buildingType: number, ressourceType: number): boolean
{
	const productionBuildingTypeArray: number[] = getProductionBuildingTypeArrayForRessourceType(ressourceType);

	return productionBuildingTypeArray.includes(buildingType);
}

export function getAllProducableRessourceTypes(): number[]
{
	const getAllProducableRessourceTypes: number[] = [];

	for (const [buildingType, productionFunction] of BuildingProductionFormulas.buildingProductionPerHoursFunctionMap)
	{
		const productionMap: Map<number, number> = productionFunction(1, null);

		for (const [ressourceType, producedQuantity] of productionMap)
		{
			if (getAllProducableRessourceTypes.includes(ressourceType) === false)
			{
				getAllProducableRessourceTypes.push(ressourceType);
			}
		}
	}

	return getAllProducableRessourceTypes;
}