"use client";

import * as MainPageTypes from "@/lib/mainPageTypes";
import * as PlayerUpdateClient from "@/lib/playerUpdateClient";
import * as UpgradeCost from "@/lib/upgradeCost";

import { formatRemainingTimeMs } from "@/lib/timeFormat";

type UpgradeViewProps =
{
	psController: MainPageTypes.PSController;
	sdsController: MainPageTypes.SDSController;
};

export function UpgradeView(props: UpgradeViewProps): React.ReactElement
{
	const currentUpgradeLevel: number = props.psController[0].predictedDBData.upgrade_level;
    const buildCompletesAt: number = props.psController[0].predictedDBData.building_upgrade_completes_at;
	const isBuilding: boolean = buildCompletesAt !== 0;

    const currentTimestamp: number = Date.now();
	const remainingMs: number = buildCompletesAt - currentTimestamp;

    const nextUpgradeCost: number = UpgradeCost.computeUpgradeCost(currentUpgradeLevel);
	const canAffordUpgrade: boolean = props.psController[0].predictedDBData.gold >= nextUpgradeCost;

	const buttonElement: React.ReactElement = isBuilding === true
		? (
			<div className="px-4 py-2 bg-yellow-600 text-white rounded">
				Building: {formatRemainingTimeMs(remainingMs)}
			</div>
		)
		: (
			<button
				onClick={() => PlayerUpdateClient.tryBuyUpgrade(props.psController)}
				disabled={canAffordUpgrade === false}
				className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
			>
				Buy upgrade (cost: {nextUpgradeCost} / time: {formatRemainingTimeMs(UpgradeCost.computeUpgradeBuildDurationSeconds(currentUpgradeLevel, props.sdsController[0]) * 1000)})
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