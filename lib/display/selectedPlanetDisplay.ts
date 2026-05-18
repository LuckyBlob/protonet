import * as Production from "@/lib/gameplay/production";
import * as SelectedPlanet from "@/lib/localStorage/selectedPlanet";
import * as PlanetData from "@/lib/playerData/buildingData";
import * as UseClientDataState from "@/lib/use/useClientDataState";
import * as PlayerDataType from "@/lib/playerData/playerDataTypes";
import * as ResourceData from "@/lib/playerData/resourceData";

export type SelectedPlanetResourceDisplayValues =
{
	resourceType: number;
	resource: number;
	productionRatePerHour: number;
	affectedByCurrentBuild: boolean;
};

export type SelectedPlanetDisplayValues =
{
	resourceDisplayValues: SelectedPlanetResourceDisplayValues[];
	buildCompletesAt: number;
};

export function getSelectedPlanetDisplayValues(clientDataStateResult: UseClientDataState.ClientDataStateResult, resourceTypes: number[]): SelectedPlanetDisplayValues | null
{
	const now: number = Date.now();

	const selectedFullPlanetDataPredicted: PlayerDataType.FullPlanetData = SelectedPlanet.getSelectedFullPlanetDataPredicted(clientDataStateResult.psController[0]);

	const buildCompletesAt: number = selectedFullPlanetDataPredicted.planetRow.building_upgrade_completes_at;
	const isBuilding: boolean = buildCompletesAt !== 0;
	const buildingBeingUpgraded: number = selectedFullPlanetDataPredicted.planetRow.building_being_upgraded;

	const resourceDisplayValues: SelectedPlanetResourceDisplayValues[] = [];

	for (const resourceType of resourceTypes)
	{
		const calculatedNewResourceQuantity: number = ResourceData.getResourceQuantity(selectedFullPlanetDataPredicted, resourceType) ?? -1;

		const productionRatePerSecond: number = Production.getPlanetProductionRatePerSecond(selectedFullPlanetDataPredicted, resourceType, clientDataStateResult.sdsController[0]);
		const productionRatePerHour: number = productionRatePerSecond * 3600;

		const affectedByCurrentBuild: boolean = (isBuilding === true) && (PlanetData.doesBuildingProduceResource(buildingBeingUpgraded, resourceType) === true);

		const singleResourceDisplayValues: SelectedPlanetResourceDisplayValues =
		{
			resourceType: resourceType,
			resource: calculatedNewResourceQuantity,
			productionRatePerHour: productionRatePerHour,
			affectedByCurrentBuild: affectedByCurrentBuild,
		};

		resourceDisplayValues.push(singleResourceDisplayValues);
	}

	const displayValues: SelectedPlanetDisplayValues =
	{
		resourceDisplayValues: resourceDisplayValues,
		buildCompletesAt: buildCompletesAt,
	};

	return displayValues;
}