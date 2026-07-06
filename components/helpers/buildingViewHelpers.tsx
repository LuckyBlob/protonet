"use client";

import { ReactElement } from "react";

import * as UseClientDataState from "@/lib/use/useClientDataState";
import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as HelperElements from "@/components/helpers/helperElements";
import * as ThingType from "@/lib/gameplay/coreData/thing/thingTypes";
import * as StaticDataHelper from "@/lib/gameplay/coreData/static/staticDataHelpers";
import * as Requirement from "@/lib/gameplay/coreData/requirement/requirements";
import * as RequirementType from "@/lib/gameplay/coreData/requirement/requirementTypes";

export type BuildingViewProps =
{
	clientDataStateResult: UseClientDataState.ClientDataStateResult;
};

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

export function getBuildingImagePath(buildingType: number, level: number): string
{
	const tier: number = getBuildingImageTier(level);

	return `/buildings/buildingType_${buildingType}/${tier}.png`;
}

export function renderCostLine(nextCostMap: Map<GameType.ResourceType, number>): ReactElement
{
	const parts: string[] = HelperElements.buildCostParts(nextCostMap);

	return <span>{parts.join(" / ")}</span>;
}

function renderRowDivider(): ReactElement
{
	return <div className="self-stretch border-l border-gray-400" />;
}

export function getBuildableBuildingTypes(selectedZone: GameType.PlanetZone): GameType.BuildingType[]
{
	return StaticDataHelper.getAllSpecificThings(ThingType.Thing.Building).filter((buildingType: GameType.BuildingType): boolean =>
	{
		return StaticDataHelper.isBuildableOnZone(StaticDataHelper.getBuildingStats(buildingType).buildableZones, selectedZone);
	});
}

export function renderFailedRequirementsBox(failedRequirements: RequirementType.Requirement[], requirementContext: RequirementType.RequirementContext): ReactElement | null
{
	const failedHidingRequirements: RequirementType.Requirement[] = failedRequirements.filter((requirement: RequirementType.Requirement): boolean => Requirement.shouldHideDataWhenRequirementFailed(requirement));
	if (failedHidingRequirements.length === 0)
	{
		return null;
	}

	const hidingDescriptions: string[] = Requirement.getRequirementDescriptions(failedHidingRequirements, requirementContext);

	const element: ReactElement =
	(
		<div className="w-full px-4 py-2 bg-gray-600 text-white rounded text-center">
			{hidingDescriptions.map((description: string): ReactElement =>
			{
				return <div key={description} className="text-xs">{description}</div>;
			})}
		</div>
	);

	return element;
}

export function renderBuildingRowShell(buildingType: GameType.BuildingType, imagePath: string, middleColumn: ReactElement, actionElement: ReactElement, tooltipLines: string[]): ReactElement
{
	const buildingImageElement: ReactElement =
	(
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
	);

	const rowElement: ReactElement =
	(
		<div key={buildingType} className="border border-gray-400 rounded p-2 flex flex-row items-center gap-4">
			{HelperElements.renderWithTooltip(tooltipLines, buildingImageElement, "below", "shrink-0")}

			{renderRowDivider()}

			{middleColumn}

			{renderRowDivider()}

			<div className="w-64 shrink-0">
				{actionElement}
			</div>
		</div>
	);

	return rowElement;
}
