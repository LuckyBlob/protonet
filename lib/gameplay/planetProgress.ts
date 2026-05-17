import * as DBType from "@/lib/db/dbTypes";

import * as AssociationMaps from "@/lib/gameplay/coreData/associationMaps";
import * as GameType from "@/lib/gameplay/gameTypes";
import * as Production from "@/lib/gameplay/production";
import * as PlanetData from "@/lib/playerData/planetData";

import * as ServerDataType from "@/lib/serverData/serverDataTypes";

export function hasAnyBuildingFinishedSinceLastUpdate(fullPlanetData: PlanetData.FullPlanetData, now: number): boolean
{
	// The last update is set when we set this, so we can just check this.
	if (fullPlanetData.planetRow.building_upgrade_completes_at === 0)
	{
		return false;
	}

	const buildCompletesAt: number = fullPlanetData.planetRow.building_upgrade_completes_at;
	const buildWasActive: boolean = buildCompletesAt !== 0;
	const buildHasFinished: boolean = (buildWasActive === true) && (now >= buildCompletesAt);

	return buildHasFinished;
}

export function hasAnyProductionBuildingFinishedSinceLastUpdate(fullPlanetData: PlanetData.FullPlanetData, now: number): boolean
{
	if (!hasAnyBuildingFinishedSinceLastUpdate(fullPlanetData, now))
	{
		return false;
	}

	if (!PlanetData.isProductionBuilding(fullPlanetData.planetRow.building_being_upgraded))
	{
		return false;
	}

	return true;
}

export function hasAnyProductionBuildingProducingRessourceFinishedSinceLastUpdate(fullPlanetData: PlanetData.FullPlanetData, now: number, ressourceType: number): boolean
{
	return hasAnyProductionBuildingFinishedSinceLastUpdate(fullPlanetData, now) && PlanetData.doesBuildingProduceRessource(fullPlanetData.planetRow.building_being_upgraded, ressourceType);
}

export function getPredictedRessourceQuantityWithoutUpgrade(fullPlanetData: PlanetData.FullPlanetData, serverData: ServerDataType.ServerData, now: number, ressourceType: number): number | null
{
	const currentRessourceQuantity: number | null = PlanetData.getRessourceQuantity(fullPlanetData, ressourceType);
	if (currentRessourceQuantity === null)
	{
		return null;
	}

	const elapsedMilliseconds: number = now - fullPlanetData.planetRow.last_updated;
	const elapsedSeconds: number = elapsedMilliseconds / 1000;
	if (elapsedSeconds <= 0)
	{
		return currentRessourceQuantity;
	}

	const productionRate: number = Production.getPlanetProductionRatePerSecond(fullPlanetData, ressourceType, serverData);
	const ressourceGained: number = productionRate * elapsedSeconds;

	const updatedRessourceQuantity: number = currentRessourceQuantity + ressourceGained;

	return updatedRessourceQuantity;
}

function getPredictedRessourceQuantityWithFinishedProductionBuildingUpgrade(fullPlanetData: PlanetData.FullPlanetData, serverData: ServerDataType.ServerData, now: number, ressourceType: number): number | null
{
	const currentUpgradeLevel: number | null = PlanetData.getBuildingLevel(fullPlanetData, fullPlanetData.planetRow.building_being_upgraded);
	if (currentUpgradeLevel === null)
	{
		return null;
	}

	const currentRessourceQuantity: number | null = PlanetData.getRessourceQuantity(fullPlanetData, ressourceType);
	if (currentRessourceQuantity === null)
	{
		return null;
	}

	const buildCompletesAt: number = fullPlanetData.planetRow.building_upgrade_completes_at;
	const rawSecondsBeforeBuildEnd: number = (buildCompletesAt - fullPlanetData.planetRow.last_updated) / 1000;
	const secondsBeforeBuildEnd: number = rawSecondsBeforeBuildEnd < 0 ? 0 : rawSecondsBeforeBuildEnd;
	const rawSecondsAfterBuildEnd: number = (now - buildCompletesAt) / 1000;
	const secondsAfterBuildEnd: number = rawSecondsAfterBuildEnd < 0 ? 0 : rawSecondsAfterBuildEnd;
	const oldProductionRate: number = Production.getPlanetProductionRatePerSecond(fullPlanetData, ressourceType, serverData);
	const newProductionRate: number = Production.getNextPlanetProductionRatePerSecond(fullPlanetData, ressourceType, fullPlanetData.planetRow.building_being_upgraded, serverData);

	const ressourceGainedPreCompletion: number = oldProductionRate * secondsBeforeBuildEnd;
	const ressourceGainedPostCompletion: number = newProductionRate * secondsAfterBuildEnd;
	const updatedRessourceQuantity: number = currentRessourceQuantity + ressourceGainedPreCompletion + ressourceGainedPostCompletion;

	return updatedRessourceQuantity;
}

export function applyPlanetProgress(fullPlanetData: PlanetData.FullPlanetData, serverData: ServerDataType.ServerData, now: number): PlanetData.FullPlanetData
{
	if (fullPlanetData.planetRow.last_updated === 0)
	{
		const anchoredPlanetData: PlanetData.FullPlanetData =
		{
			...fullPlanetData,
			planetRow:
			{
				...fullPlanetData.planetRow,
				last_updated: now,
			},
		};

		return anchoredPlanetData;
	}

	const allRessourceTypes: number[] = PlanetData.getAllProducableRessourceTypes();
	for (const ressourceType of allRessourceTypes)
	{
		fullPlanetData = applyPlanetProgressForRessource(fullPlanetData, serverData, now, ressourceType);
	}

	fullPlanetData = processBuildFinishes(fullPlanetData, serverData, now);

	const completedPlanetData: PlanetData.FullPlanetData =
	{
		...fullPlanetData,
		planetRow:
		{
			...fullPlanetData.planetRow,
			last_updated: now,
		},
	};
	
	return completedPlanetData;
}

export function applyPlanetProgressForRessource(fullPlanetData: PlanetData.FullPlanetData, serverData: ServerDataType.ServerData, now: number, ressourceType: number): PlanetData.FullPlanetData
{
	if (!hasAnyProductionBuildingProducingRessourceFinishedSinceLastUpdate(fullPlanetData, now, ressourceType))
	{
		const calculatedNewRessourceQuantity: number | null = getPredictedRessourceQuantityWithoutUpgrade(fullPlanetData, serverData, now, ressourceType);
		if (calculatedNewRessourceQuantity === null)
		{
			return fullPlanetData;
		}

		const updatedPlanetData: PlanetData.FullPlanetData =
		{
			...fullPlanetData,
		};
		PlanetData.setRessourceQuantity(updatedPlanetData, ressourceType, calculatedNewRessourceQuantity);

		return updatedPlanetData;
	}

	const calculatedNewRessourceQuantity: number | null = getPredictedRessourceQuantityWithFinishedProductionBuildingUpgrade(fullPlanetData, serverData, now, ressourceType);
	if (calculatedNewRessourceQuantity === null)
	{
		return fullPlanetData;
	}
	
	const updatedPlanetData: PlanetData.FullPlanetData =
	{
		...fullPlanetData,
	};
	PlanetData.setRessourceQuantity(updatedPlanetData, ressourceType, calculatedNewRessourceQuantity);

	return updatedPlanetData;
}

export function processBuildFinishes(fullPlanetData: PlanetData.FullPlanetData, serverData: ServerDataType.ServerData, now: number): PlanetData.FullPlanetData
{
	if (!hasAnyBuildingFinishedSinceLastUpdate(fullPlanetData, now))
	{
		return fullPlanetData;
	}

	const completedPlanetData: PlanetData.FullPlanetData=
	{
		...fullPlanetData,
		planetRow:
		{
			...fullPlanetData.planetRow,
			building_being_upgraded: 0,
			building_upgrade_completes_at: 0,
		}
	};
	const oldLevel: number | null = PlanetData.getBuildingLevel(fullPlanetData, fullPlanetData.planetRow.building_being_upgraded);
	if (oldLevel === null)
	{
		return completedPlanetData;
	}
	PlanetData.setBuildingLevel(completedPlanetData, fullPlanetData.planetRow.building_being_upgraded, oldLevel + 1);
	console.log(` a1 ${fullPlanetData.planetRow.building_upgrade_completes_at} ${fullPlanetData.planetRow.system}`);

	return completedPlanetData;
}
