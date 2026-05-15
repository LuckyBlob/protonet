import * as DBTypes from "@/lib/db/dbTypes";
import * as Production from "@/lib/gameplay/production";
import * as Association from "@/lib/gameplay/associations";
import * as GameType from "@/lib/gameplay/gameTypes";
import * as ServerDataType from "@/lib/serverData/serverDataTypes";

export function applyPlanetProgress(planetRow: DBTypes.PlanetRow, serverData: ServerDataType.ServerData, now: number, applyOnlyIfBuildDoneOnly: boolean = false): DBTypes.PlanetRow
{
	if (planetRow.last_updated === 0)
	{
		const anchoredRow: DBTypes.PlanetRow =
		{
			...planetRow,
			last_updated: now,
		};

		return anchoredRow;
	}
	console.log("1");

	const elapsedMilliseconds: number = now - planetRow.last_updated;

	if (elapsedMilliseconds <= 0)
	{
		return planetRow;
	}
	console.log("2");

	const elapsedSeconds: number = elapsedMilliseconds / 1000;

	const buildCompletesAt: number = planetRow.building_upgrade_completes_at;
	const buildWasActive: boolean = buildCompletesAt !== 0;
	const buildHasFinished: boolean = (buildWasActive === true) && (now >= buildCompletesAt);

    const currentRessourceQuantity : number | null = Association.getRessourceQuantityForRessourceType(planetRow, GameType.RESSOURCE_1);
    
    if (currentRessourceQuantity === null)
    {
        return planetRow;
    }
	console.log("3");

    console.log({ buildCompletesAt, now, buildWasActive, buildHasFinished, diff: buildCompletesAt - now });
	if ((buildWasActive === false) || (buildHasFinished === false))
	{
		// Client tick path: nothing to commit when no event has occurred. The
		// display layer derives the live ressource value from last_updated.
		if (applyOnlyIfBuildDoneOnly)
		{
			return planetRow;
		}

		const productionRate: number = Production.getPlanetProductionRatePerSecond(planetRow, GameType.RESSOURCE_1, serverData);
		const ressourceGained: number = productionRate * elapsedSeconds;

		const updatedRessourceQuantity: number = currentRessourceQuantity + ressourceGained;

		const advancedRow: DBTypes.PlanetRow =
		{
			...planetRow,
			ressource_1: updatedRessourceQuantity,
			last_updated: now,
		};

		return advancedRow;
	}
	console.log("4");

	const rawSecondsBeforeBuildEnd: number = (buildCompletesAt - planetRow.last_updated) / 1000;
	const secondsBeforeBuildEnd: number = rawSecondsBeforeBuildEnd < 0 ? 0 : rawSecondsBeforeBuildEnd;
	const rawSecondsAfterBuildEnd: number = (now - buildCompletesAt) / 1000;
	const secondsAfterBuildEnd: number = rawSecondsAfterBuildEnd < 0 ? 0 : rawSecondsAfterBuildEnd;

	const currentUpgradeLevel: number | null = Association.getProductionBuildingLevelForBuilding(planetRow, GameType.BUILDING_PRODUCTION_RESSOURCE_1);

	if (currentUpgradeLevel === null)
	{
		return planetRow;
	}
	console.log("5");

	const oldProductionRate: number = Production.getPlanetProductionRatePerSecond(planetRow, GameType.RESSOURCE_1, serverData);
	const newProductionRate: number = Production.getNextPlanetProductionRatePerSecond(planetRow, GameType.RESSOURCE_1, serverData);

	const newUpgradeLevel: number = currentUpgradeLevel + 1;

	const ressourceGainedPreCompletion: number = oldProductionRate * secondsBeforeBuildEnd;
	const ressourceGainedPostCompletion: number = newProductionRate * secondsAfterBuildEnd;
	const updatedRessourceQuantity: number = currentRessourceQuantity + ressourceGainedPreCompletion + ressourceGainedPostCompletion;

	const completedRow: DBTypes.PlanetRow =
	{
		...planetRow,
		ressource_1: updatedRessourceQuantity,
		ressource_1_production_level: newUpgradeLevel,
		building_upgrade_completes_at: 0,
		last_updated: now,
	};

	return completedRow;
}