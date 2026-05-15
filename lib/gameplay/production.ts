import * as DBTypes from "@/lib/db/dbTypes";

import * as GameType from "@/lib/gameplay/gameTypes";

import * as ServerDataTypes from "@/lib/serverData/serverDataTypes";

export const RESSOURCE_1_BASE_PRODUCTION_RATE: number = 30;

export function getPlanetProductionRatePerSecond(planetRow: DBTypes.PlanetRow, ressourceType: number, serverData: ServerDataTypes.ServerData): number
{
	return getRawPlanetProductionRatePerSecond(planetRow.ressource_1_production_level, ressourceType, planetRow.size, serverData);
}

export function getNextPlanetProductionRatePerSecond(planetRow: DBTypes.PlanetRow, ressourceType: number, serverData: ServerDataTypes.ServerData): number
{
	return getRawPlanetProductionRatePerSecond(planetRow.ressource_1_production_level + 1, ressourceType, planetRow.size, serverData);
}

function getRawPlanetProductionRatePerSecond(upgradeLevel: number, ressourceType: number, planetSize: number, serverData: ServerDataTypes.ServerData): number
{
	const perSecondBaseProductionRate: number = RESSOURCE_1_BASE_PRODUCTION_RATE / 3600;

	const productionRate: number = upgradeLevel === 0 ? perSecondBaseProductionRate : perSecondBaseProductionRate * upgradeLevel * Math.pow(1.1, upgradeLevel);
	return productionRate * serverData.config.time_multiplier;
}

