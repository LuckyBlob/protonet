"use client";

import * as Cost from "@/lib/gameplay/cost";
import * as TimeFormat from "@/lib/helper/timeFormat";
import * as SelectedPlanet from "@/lib/localStorage/selectedPlanet";
import * as PlanetData from "@/lib/playerData/buildingData";
import * as UseClientDataState from "@/lib/use/useClientDataState";
import * as PlayerUpdateClient from "@/lib/update/client/playerUpdateClient";
import * as AssociationMaps from "@/lib/gameplay/coreData/associationMaps";
import * as PlayerDataType from "@/lib/playerData/playerDataTypes";
import * as BuildingData from "@/lib/playerData/buildingData";

type UpgradeViewProps =
{
	clientDataStateResult: UseClientDataState.ClientDataStateResult;
};

// Image changes every IMAGE_TIER_LEVEL_STEP levels, capped at MAX_IMAGE_TIER so
// missing high-level art falls back to the last available image. Tune freely.
// Expected files: public/buildings/buildingType_{buildingType}/{tier}.png
const IMAGE_TIER_LEVEL_STEP: number = 5;
const MAX_IMAGE_TIER: number = 5;

function getBuildingImageTier(level: number): number
{
	const rawTier: number = Math.floor(level / IMAGE_TIER_LEVEL_STEP);

	if (rawTier > MAX_IMAGE_TIER)
	{
		return MAX_IMAGE_TIER;
	}

	return rawTier;
}

function getBuildingImagePath(buildingType: number, level: number): string
{
	const tier: number = getBuildingImageTier(level);

	return `/buildings/buildingType_${buildingType}/${tier}.png`;
}

function renderCostLine(nextCostMap: Map<number, number>): React.ReactElement
{
	const parts: string[] = [];

	for (const [resourceType, resourceCost] of nextCostMap)
	{
		const resourceName: string = AssociationMaps.RESOURCE_DISPLAY_NAMES.get(resourceType) ?? `Resource ${resourceType}`;
		parts.push(`${resourceCost} ${resourceName}`);
	}

	return <span>{parts.join(" / ")}</span>;
}

function renderBuildingCard(props: UpgradeViewProps, selectedFullPlanetDataPredicted: PlayerDataType.FullPlanetData, buildingType: number): React.ReactElement
{
	const displayName: string = AssociationMaps.BUILDING_DISPLAY_NAMES.get(buildingType) ?? `Building ${buildingType}`;
	const currentLevel: number = PlanetData.getBuildingLevel(selectedFullPlanetDataPredicted, buildingType);

	const nextCostMap: Map<number, number> | null = Cost.computeBuildingUpgradeCost(currentLevel, buildingType);
	const buildDurationSeconds: number | null = PlanetData.getBuildingUpgradeDurationSeconds(selectedFullPlanetDataPredicted, props.clientDataStateResult.sdsController[0], buildingType);

	if (nextCostMap === null || buildDurationSeconds === null)
	{
		return (
			<div key={buildingType} className="border border-gray-400 rounded p-4 w-64">
				{displayName} (level {currentLevel}): cannot compute upgrade.
			</div>
		);
	}

	const imagePath: string = getBuildingImagePath(buildingType, currentLevel);

	const isThisBuildingUpgrading: boolean = (selectedFullPlanetDataPredicted.planetRow.building_being_upgraded === buildingType) && (selectedFullPlanetDataPredicted.planetRow.building_upgrade_completes_at !== 0);
	const isAnyBuildingUpgrading: boolean = selectedFullPlanetDataPredicted.planetRow.building_upgrade_completes_at !== 0;

	const remainingMs: number = selectedFullPlanetDataPredicted.planetRow.building_upgrade_completes_at - Date.now();
	const canAfford: boolean = Cost.canAffordUpgrade(selectedFullPlanetDataPredicted, buildingType);

	const handleBuyUpgrade: () => void = () =>
	{
		PlayerUpdateClient.tryBuyBuildingUpgradeClient(props.clientDataStateResult.psController, selectedFullPlanetDataPredicted.planetRow.id, buildingType);
	};

	const levelLine: React.ReactElement = isThisBuildingUpgrading === true
		? <div className="text-sm">{"Level"} {currentLevel} {"->"} {"Level"} {currentLevel + 1}</div>
		: <div className="text-sm">Level {currentLevel}</div>;

	const actionElement: React.ReactElement = isThisBuildingUpgrading === true
		? (
			<div className="w-full px-4 py-2 bg-yellow-600 text-white rounded text-center">
				<div className="font-bold">Building</div>
				<div className="text-xs">Time: {TimeFormat.formatRemainingTimeMs(remainingMs)}</div>
			</div>
		)
		: (
			<button
				onClick={handleBuyUpgrade}
				disabled={(canAfford === false) || (isAnyBuildingUpgrading === true)}
				className="w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed flex flex-col items-center"
			>
				<span className="font-bold">Build Upgrade</span>
				<span className="text-xs">{renderCostLine(nextCostMap)}</span>
				<span className="text-xs">Time: {TimeFormat.formatRemainingTimeMs(buildDurationSeconds * 1000)}</span>
			</button>
		);

	const cardElement: React.ReactElement =
	(
		<div key={buildingType} className="border border-gray-400 rounded p-4 w-64 flex flex-col items-center gap-2">
			<div className="w-full h-32 flex flex-col items-center justify-center text-center">
				<img
					src={imagePath}
					alt=""
					className="w-32 h-32 object-contain"
					onError={(e) =>
					{
						(e.currentTarget as HTMLImageElement).style.display = "none";
						const fallback: HTMLElement | null = (e.currentTarget.nextElementSibling as HTMLElement | null);
						if (fallback !== null)
						{
							fallback.style.display = "flex";
						}
					}}
				/>
				<div className="hidden flex-col items-center justify-center text-xs gap-1">
					<span>[Image Unavailable - Imagine it]</span>
				</div>
			</div>
			<div className="font-bold text-center">{displayName}</div>
			{levelLine}
			{actionElement}
		</div>
	);

	return cardElement;
}

export function UpgradeView(props: UpgradeViewProps): React.ReactElement
{
	const selectedFullPlanetDataPredicted: PlayerDataType.FullPlanetData = SelectedPlanet.getSelectedFullPlanetDataPredicted(props.clientDataStateResult.psController[0]);

	const cardElements: React.ReactElement[] = AssociationMaps.getTypes(AssociationMaps.ThingType.Building).map((buildingType: number): React.ReactElement =>
	{
		return renderBuildingCard(props, selectedFullPlanetDataPredicted, buildingType);
	});

	const upgradeViewElement: React.ReactElement =
	(
		<div className="flex flex-row flex-wrap justify-center gap-4 p-4">
			{cardElements}
		</div>
	);

	return upgradeViewElement;
}