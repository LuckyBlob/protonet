"use client";

import { ReactElement } from "react";

import * as TimeFormat from "@/lib/helper/timeFormat";
import * as SelectedPlanet from "@/lib/localStorage/selectedPlanet";
import * as UseClientDataState from "@/lib/use/useClientDataState";
import * as ClientRequestFunctions from "@/lib/networkRequests/client/clientRequestFunctions";
import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as HelperElements from "@/components/helperElements";
import * as Requirement from "@/lib/gameplay/coreData/requirement/requirements";
import * as RequirementType from "@/lib/gameplay/coreData/requirement/requirementTypes";
import * as ThingType from "@/lib/gameplay/coreData/thing/thingTypes";
import * as ThingHelpers from "@/lib/gameplay/coreData/thing/thingHelpers";
import * as ThingDataHelpers from "@/lib/gameplay/coreData/thing/thingDataHelpers";
import * as StaticDataHelper from "@/lib/gameplay/coreData/static/staticDataHelpers";
import * as BuildingData from "@/lib/gameplay/dynamicData/planet/buildingData";
import * as ResearchData from "@/lib/gameplay/dynamicData/player/researchData";
import * as ResearchCost from "@/lib/gameplay/coreData/formula/researchCostFormulas";
import * as ResearchDuration from "@/lib/gameplay/coreData/formula/researchDurationFormulas";

type ResearchViewProps =
{
	clientDataStateResult: UseClientDataState.ClientDataStateResult;
};

// Image changes every IMAGE_TIER_LEVEL_STEP levels, capped at MAX_IMAGE_TIER so
// missing high-level art falls back to the last available image. Tune freely.
// Expected files: public/researches/researchType_{researchType}/{tier}.png
const IMAGE_TIER_LEVEL_STEP: number = 5;
const MAX_IMAGE_TIER: number = 5;

function getResearchImageTier(level: number): number
{
	const rawTier: number = Math.floor(level / IMAGE_TIER_LEVEL_STEP);

	if (rawTier > MAX_IMAGE_TIER)
	{
		return MAX_IMAGE_TIER;
	}

	return rawTier;
}

function getResearchImagePath(researchType: number, level: number): string
{
	const tier: number = getResearchImageTier(level);

	return `/researches/researchType_${researchType}/${tier}.png`;
}

function renderCostLine(nextCostMap: Map<GameType.ResourceType, number>): ReactElement
{
	const parts: string[] = HelperElements.buildCostParts(nextCostMap);

	return <span>{parts.join(" / ")}</span>;
}

function renderRowDivider(): ReactElement
{
	return <div className="self-stretch border-l border-gray-400" />;
}

function renderResearchRow(props: ResearchViewProps, selectedPlanetDataPredicted: CoreType.PlanetData, researchType: GameType.ResearchType): ReactElement
{
	const playerData: CoreType.PlayerData = props.clientDataStateResult.psController[0].predictedDBData;
	const planetId: number = selectedPlanetDataPredicted.planetRow.id;

	const displayName: string = ThingDataHelpers.getSpecificThingName(ThingHelpers.research(researchType));
	const currentLevel: number = ResearchData.getResearchLevel(playerData, researchType);

	const nextCostMap: Map<GameType.ResourceType, number> | null = ResearchCost.computeResearchUpgradeCost(currentLevel, researchType);
	const researchDurationSeconds: number | null = ResearchDuration.computeResearchDurationSeconds(currentLevel, researchType, playerData, planetId, props.clientDataStateResult.sdsController[0]);

	if (nextCostMap === null || researchDurationSeconds === null)
	{
		return (
			<div key={researchType} className="border border-gray-400 rounded p-4">
				{displayName} (level {currentLevel}): cannot compute research.
			</div>
		);
	}

	const imagePath: string = getResearchImagePath(researchType, currentLevel);

	const isThisResearching: boolean = ResearchData.isResearchTypeCurrentlyResearching(playerData, researchType);
	const failedRequirements: RequirementType.Requirement[] = Requirement.getFailedResearchRequirements(playerData, researchType, planetId);
	const failedHidingRequirements: RequirementType.Requirement[] = failedRequirements.filter((requirement: RequirementType.Requirement): boolean => requirement.hideDataWhenRequirementFailed === true);
	const hidingDescriptions: string[] = Requirement.getRequirementDescriptions(failedHidingRequirements, playerData, planetId);

	const remainingMs: number = ResearchData.getCurrentlyResearchingRemainingMs(playerData) ?? 0;
	const canAfford: boolean = ResearchData.canAffordResearch(playerData, selectedPlanetDataPredicted, researchType);

	const handleBuyResearch: () => void = () =>
	{
		ClientRequestFunctions.clientTryUpgradeResearchRequest(props.clientDataStateResult.psController, planetId, researchType);
	};

	const levelLine: ReactElement = isThisResearching === true
		? <div className="text-sm">{"Level"} {currentLevel} {"->"} {"Level"} {currentLevel + 1}</div>
		: <div className="text-sm">Level {currentLevel}</div>;

	const actionElement: ReactElement = isThisResearching === true
		? (
			<div className="w-full px-4 py-2 bg-yellow-600 text-white rounded text-center">
				<div className="font-bold">Researching</div>
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
				onClick={handleBuyResearch}
				disabled={(canAfford === false) || (failedRequirements.length > 0)}
				className="w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed flex flex-col items-center"
			>
				<span className="font-bold">Research</span>
				<span className="text-xs">{renderCostLine(nextCostMap)}</span>
				<span className="text-xs">Time: {TimeFormat.formatRemainingTimeMs(researchDurationSeconds * 1000)}</span>
			</button>
		);

	const rowElement: ReactElement =
	(
		<div key={researchType} className="border border-gray-400 rounded p-2 flex flex-row items-center gap-4">
			<div className="w-16 h-16 flex flex-col items-center justify-center text-center shrink-0">
				<img
					src={imagePath}
					alt=""
					className="w-16 h-16 object-contain"
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
				<div className="hidden flex-col items-center justify-center text-[10px] gap-1">
					<span>[No Image]</span>
				</div>
			</div>

			{renderRowDivider()}

			<div className="flex flex-col justify-center min-w-48">
				<div className="font-bold">{displayName}</div>
				{levelLine}
			</div>

			{renderRowDivider()}

			<div className="w-64 shrink-0">
				{actionElement}
			</div>
		</div>
	);

	return rowElement;
}

export function ResearchView(props: ResearchViewProps): ReactElement
{
	try
	{
		const selectedPlanetDataPredicted: CoreType.PlanetData = SelectedPlanet.getSelectedPlanetDataPredicted(props.clientDataStateResult.psController[0]);

		const researchLabLevel: number = BuildingData.getBuildingLevel(selectedPlanetDataPredicted, GameType.BuildingType.ResearchLab);
		if (researchLabLevel < 1)
		{
			const noResearchLabElement: ReactElement =
			(
				<div className="flex flex-col items-center justify-center p-8 text-lg text-gray-300">
					No Research Lab
				</div>
			);

			return noResearchLabElement;
		}

		const rowElements: ReactElement[] = StaticDataHelper.getAllSpecificThings(ThingType.Thing.Research).map((researchType: GameType.ResearchType): ReactElement =>
		{
			return renderResearchRow(props, selectedPlanetDataPredicted, researchType);
		});

		const researchViewElement: ReactElement =
		(
			<div className="flex flex-col gap-2 p-4">
				{rowElements}
			</div>
		);

		return researchViewElement;
	}
	catch (error: unknown)
	{
		console.error("⚠️:", error);
		return <HelperElements.EmptyElement></HelperElements.EmptyElement>;
	}
}
