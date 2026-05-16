"use client";

import * as DBType from "@/lib/db/dbTypes";

import * as Cost from "@/lib/gameplay/cost";
import * as Duration from "@/lib/gameplay/duration";
import * as GameType from "@/lib/gameplay/gameTypes";

import * as TimeFormat from "@/lib/helper/timeFormat";

import * as SelectedPlanet from "@/lib/localStorage/selectedPlanet";

import * as UseClientDataState from "@/lib/use/useClientDataState";

import * as PlayerUpdateClient from "@/lib/update/client/playerUpdateClient";

type UpgradeViewProps =
{
	clientDataStateResult: UseClientDataState.ClientDataStateResult;
};

export function UpgradeView(props: UpgradeViewProps): React.ReactElement
{
	const selectedPlanet: DBType.PlanetRow = SelectedPlanet.getSelectedPlanetRow(props.clientDataStateResult.psController[0]);

	const currentUpgradeLevel: number = selectedPlanet.ressource_1_production_level;
	const buildCompletesAt: number = selectedPlanet.building_upgrade_completes_at;
	const isBuilding: boolean = buildCompletesAt !== 0;

	const currentTimestamp: number = Date.now();
	const remainingMs: number = buildCompletesAt - currentTimestamp;

	const nextUpgradeCost: number | null = Cost.computeUpgradeCost(currentUpgradeLevel, GameType.BUILDING_PRODUCTION_RESSOURCE_1);
	const buildDurationSeconds: number | null = Duration.computeUpgradeBuildDurationSeconds(currentUpgradeLevel, GameType.BUILDING_PRODUCTION_RESSOURCE_1, props.clientDataStateResult.sdsController[0]);

	if (nextUpgradeCost === null || buildDurationSeconds === null)
	{
		return <div>Cannot compute upgrade for this building type.</div>;
	}

	const canAffordUpgrade: boolean = Cost.canAffordUpgrade(selectedPlanet, GameType.BUILDING_PRODUCTION_RESSOURCE_1);

	const planetIdForBuy: number = selectedPlanet.id;
	const handleBuyUpgrade: () => void = () =>
	{
		PlayerUpdateClient.tryBuyBuildingUpgradeClient(props.clientDataStateResult.psController, planetIdForBuy);
	};

	const buttonElement: React.ReactElement = isBuilding === true
		? (
			<div className="px-4 py-2 bg-yellow-600 text-white rounded">
				Building: {TimeFormat.formatRemainingTimeMs(remainingMs)}
			</div>
		)
		: (
			<button
				onClick={handleBuyUpgrade}
				disabled={canAffordUpgrade === false}
				className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
			>
				Buy upgrade (cost: {nextUpgradeCost} / time: {TimeFormat.formatRemainingTimeMs(buildDurationSeconds * 1000)})
			</button>
		);

	const upgradeViewElement: React.ReactElement =
	(
		<div className="flex flex-col items-center gap-4">
			<div>Current level: {currentUpgradeLevel}</div>
			{buttonElement}
		</div>
	);

	return upgradeViewElement;
}