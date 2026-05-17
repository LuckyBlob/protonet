import * as Production from "@/lib/gameplay/production";
import * as SelectedPlanet from "@/lib/localStorage/selectedPlanet";
import * as PlanetProgress from "@/lib/gameplay/planetProgress";
import * as PlanetData from "@/lib/playerData/planetData";
import * as UseClientDataState from "@/lib/use/useClientDataState";

export type SelectedPlanetRessourceDisplayValues =
{
	ressourceType: number;
	ressource: number;
	productionRatePerHour: number;
	affectedByCurrentBuild: boolean;
};

export type SelectedPlanetDisplayValues =
{
	ressourceDisplayValues: SelectedPlanetRessourceDisplayValues[];
	buildCompletesAt: number;
};

// Per-resource display values for the currently selected planet. One entry per
// resource type passed in (driven by RESSOURCE_DISPLAY_NAMES upstream, so
// adding a resource adds a card with no change here). affectedByCurrentBuild
// is true only when a build is in progress AND the building being upgraded
// produces that resource -- the build timer should only show on those cards.
export function getSelectedPlanetDisplayValues(clientDataStateResult: UseClientDataState.ClientDataStateResult, ressourceTypes: number[]): SelectedPlanetDisplayValues | null
{
	const now: number = Date.now();

	const selectedFullPlanetDataPredicted: PlanetData.FullPlanetData = SelectedPlanet.getSelectedFullPlanetDataPredicted(clientDataStateResult.psController[0]);

	const buildCompletesAt: number = selectedFullPlanetDataPredicted.planetRow.building_upgrade_completes_at;
	const isBuilding: boolean = buildCompletesAt !== 0;
	const buildingBeingUpgraded: number = selectedFullPlanetDataPredicted.planetRow.building_being_upgraded;

	const ressourceDisplayValues: SelectedPlanetRessourceDisplayValues[] = [];

	for (const ressourceType of ressourceTypes)
	{
		const calculatedNewRessourceQuantity: number | null = PlanetProgress.getPredictedRessourceQuantityWithoutUpgrade(selectedFullPlanetDataPredicted, clientDataStateResult.sdsController[0], now, ressourceType);

		if (calculatedNewRessourceQuantity === null)
		{
			continue;
		}

		const productionRatePerSecond: number = Production.getPlanetProductionRatePerSecond(selectedFullPlanetDataPredicted, ressourceType, clientDataStateResult.sdsController[0]);
		const productionRatePerHour: number = productionRatePerSecond * 3600;

		const affectedByCurrentBuild: boolean = (isBuilding === true) && (PlanetData.doesBuildingProduceRessource(buildingBeingUpgraded, ressourceType) === true);

		const singleRessourceDisplayValues: SelectedPlanetRessourceDisplayValues =
		{
			ressourceType: ressourceType,
			ressource: calculatedNewRessourceQuantity,
			productionRatePerHour: productionRatePerHour,
			affectedByCurrentBuild: affectedByCurrentBuild,
		};

		ressourceDisplayValues.push(singleRessourceDisplayValues);
	}

	const displayValues: SelectedPlanetDisplayValues =
	{
		ressourceDisplayValues: ressourceDisplayValues,
		buildCompletesAt: buildCompletesAt,
	};

	return displayValues;
}