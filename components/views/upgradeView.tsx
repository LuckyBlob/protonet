"use client";

import { ReactElement } from "react";

import * as TimeFormat from "@/lib/helper/timeFormat";
import * as SelectedPlanet from "@/lib/localStorage/selectedPlanet";
import * as UseClientDataState from "@/lib/use/useClientDataState";
import * as ClientRequestFunctions from "@/lib/networkRequests/client/clientRequestFunctions";
import * as PlayerDataType from "@/lib/gameplay/gameplayData/player/playerDataTypes";
import * as HelperElements from "@/components/helperElements";
import * as Requirement from "@/lib/gameplay/coreData/requirement/requirements";
import * as RequirementType from "@/lib/gameplay/coreData/requirement/requirementTypes";
import * as ThingType from "@/lib/gameplay/coreData/type/thingTypes";
import * as BuildingData from "@/lib/gameplay/gameplayData/dynamic/buildingData";
import * as BuildingCost from "@/lib/gameplay/coreData/formula/buildingCostFormulas";
import * as BuildingDuration from "@/lib/gameplay/coreData/formula/buildingDurationFormulas";
import * as BuildingUpgradeData from "@/lib/gameplay/gameplayData/dynamic/buildingUpgradeData";
import * as DBType from "@/lib/db/dbTypes";

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

function renderCostLine(nextCostMap: Map<number, number>): ReactElement
{
	const parts: string[] = [];

	for (const [resourceType, resourceCost] of nextCostMap)
	{
		const resourceName: string = ThingType.getSpecificThingName(ThingType.resource(resourceType));
		parts.push(`${resourceCost} ${resourceName}`);
	}

	return <span>{parts.join(" / ")}</span>;
}

function renderBuildingCard(props: UpgradeViewProps, selectedFullPlanetDataPredicted: PlayerDataType.FullPlanetData, buildingType: number): ReactElement
{
	const playerData: PlayerDataType.PlayerData = props.clientDataStateResult.psController[0].predictedDBData;
	const planetId: number = selectedFullPlanetDataPredicted.planetRow.id;

	const displayName: string = ThingType.getSpecificThingName(ThingType.building(buildingType));
	const currentLevel: number = BuildingData.getBuildingLevel(selectedFullPlanetDataPredicted, buildingType);

	const nextCostMap: Map<number, number> | null = BuildingCost.computeBuildingUpgradeCost(currentLevel, buildingType);
	const buildDurationSeconds: number | null = BuildingDuration.computeUpgradeDurationSeconds(currentLevel, buildingType, playerData, planetId, props.clientDataStateResult.sdsController[0]);

	if (nextCostMap === null || buildDurationSeconds === null)
	{
		return (
			<div key={buildingType} className="border border-gray-400 rounded p-4 w-64">
				{displayName} (level {currentLevel}): cannot compute upgrade.
			</div>
		);
	}

	const imagePath: string = getBuildingImagePath(buildingType, currentLevel);

	const isThisBuildingUpgrading: boolean = BuildingUpgradeData.isBuildingTypeCurrentlyUpgrading(selectedFullPlanetDataPredicted, buildingType);
	const failedRequirements: RequirementType.Requirement[] = Requirement.getFailedBuildingUpgradeRequirements(playerData, buildingType, planetId);
	const failedHidingRequirements: RequirementType.Requirement[] = failedRequirements.filter((requirement: RequirementType.Requirement): boolean => requirement.hideDataWhenRequirementFailed === true);
	const hidingDescriptions: string[] = Requirement.getRequirementDescriptions(failedHidingRequirements, playerData, planetId);

	const remainingMs: number = BuildingUpgradeData.getBuildingUpgradeRemainingMs(selectedFullPlanetDataPredicted) ?? 0;
	const canAfford: boolean = BuildingData.canAffordUpgrade(selectedFullPlanetDataPredicted, buildingType);

	const handleBuyUpgrade: () => void = () =>
	{
		ClientRequestFunctions.clientTryUpgradeBuildingRequest(props.clientDataStateResult.psController, planetId, buildingType);
	};

	const levelLine: ReactElement = isThisBuildingUpgrading === true
		? <div className="text-sm">{"Level"} {currentLevel} {"->"} {"Level"} {currentLevel + 1}</div>
		: <div className="text-sm">Level {currentLevel}</div>;

	const actionElement: ReactElement = isThisBuildingUpgrading === true
		? (
			<div className="w-full px-4 py-2 bg-yellow-600 text-white rounded text-center">
				<div className="font-bold">Building</div>
				<div className="text-xs">Time: {TimeFormat.formatRemainingTimeMs(remainingMs)}</div>
			</div>
		)
		: (failedHidingRequirements.length > 0)
		? (
			<div className="w-full px-4 py-2 bg-gray-600 text-white rounded text-center">
				{hidingDescriptions.map((description: string) =>
				{
					return <div key={description} className="text-xs">{description}</div>;
				})}
			</div>
		)
		: (
			<button
				onClick={handleBuyUpgrade}
				disabled={(canAfford === false) || (failedRequirements.length > 0)}
				className="w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed flex flex-col items-center"
			>
				<span className="font-bold">Build Upgrade</span>
				<span className="text-xs">{renderCostLine(nextCostMap)}</span>
				<span className="text-xs">Time: {TimeFormat.formatRemainingTimeMs(buildDurationSeconds * 1000)}</span>
			</button>
		);

	const cardElement: ReactElement =
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

export function UpgradeView(props: UpgradeViewProps): ReactElement
{
	try
	{
		const selectedFullPlanetDataPredicted: PlayerDataType.FullPlanetData = SelectedPlanet.getSelectedFullPlanetDataPredicted(props.clientDataStateResult.psController[0]);

		const cardElements: ReactElement[] = ThingType.getAllSpecificThings(ThingType.Thing.Building).map((buildingType: number): ReactElement =>
		{
			return renderBuildingCard(props, selectedFullPlanetDataPredicted, buildingType);
		});

		const upgradeViewElement: ReactElement =
		(
			<div className="flex flex-row flex-wrap justify-center gap-4 p-4">
				{cardElements}
			</div>
		);

		return upgradeViewElement;
	}
	catch (error: unknown)
	{
		console.error("⚠️:", error);
		return <HelperElements.EmptyElement></HelperElements.EmptyElement>;
	}
}
