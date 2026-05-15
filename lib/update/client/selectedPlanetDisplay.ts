import * as DBType from "@/lib/db/dbTypes";

import * as Association from "@/lib/gameplay/associations";
import * as GameType from "@/lib/gameplay/gameTypes";
import * as Production from "@/lib/gameplay/production";

import * as SelectedPlanet from "@/lib/localStorage/selectedPlanet";

import * as UseLoadClientDataState from "@/lib/use/useLoadClientDataState";

export type SelectedPlanetDisplayValues =
{
	ressource: number;
	productionRatePerHour: number;
	buildCompletesAt: number;
};

export function getSelectedPlanetDisplayValues(clientDataStateResult: UseLoadClientDataState.ClientDataStateResult): SelectedPlanetDisplayValues
{
	const selectedPlanet: DBType.PlanetRow = SelectedPlanet.getSelectedPlanetRow(clientDataStateResult.psController[0]);

	const rawRessourceQuantity: number | null = Association.getRessourceQuantityForRessourceType(selectedPlanet, GameType.RESSOURCE_1);
	const storedRessourceQuantity: number = rawRessourceQuantity ?? 0;

	const productionRatePerSecond: number = Production.getPlanetProductionRatePerSecond(selectedPlanet, GameType.RESSOURCE_1, clientDataStateResult.sdsController[0]);
	const now: number = Date.now();
	const elapsedMilliseconds: number = now - selectedPlanet.last_updated;
	const elapsedSeconds: number = elapsedMilliseconds > 0 ? elapsedMilliseconds / 1000 : 0;
	const accruedSinceAnchor: number = productionRatePerSecond * elapsedSeconds;

	const ressource: number = Math.floor(storedRessourceQuantity + accruedSinceAnchor);

	const productionRatePerHour: number = Math.floor(productionRatePerSecond * 3600);

	const buildCompletesAt: number = selectedPlanet.building_upgrade_completes_at;

	const displayValues: SelectedPlanetDisplayValues =
	{
		ressource,
		productionRatePerHour,
		buildCompletesAt,
	};

	return displayValues;
}