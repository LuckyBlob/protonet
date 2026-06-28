"use client";

import { ChangeEvent, ReactElement } from "react";

import * as TimeFormat from "@/lib/helper/timeFormat";
import * as SelectedPlanet from "@/lib/localStorage/selectedPlanet";
import * as ClientRequestFunctions from "@/lib/networkRequests/client/clientRequestFunctions";
import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as HelperElements from "@/components/helpers/helperElements";
import * as Requirement from "@/lib/gameplay/coreData/requirement/requirements";
import * as RequirementType from "@/lib/gameplay/coreData/requirement/requirementTypes";
import * as ThingHelpers from "@/lib/gameplay/coreData/thing/thingHelpers";
import * as ThingDataHelpers from "@/lib/gameplay/coreData/thing/thingDataHelpers";
import * as BuildingData from "@/lib/gameplay/dynamicData/planet/buildingData";
import * as BuildingCost from "@/lib/gameplay/coreData/formula/buildingCostFormulas";
import * as BuildingDuration from "@/lib/gameplay/coreData/formula/buildingDurationFormulas";
import * as BuildingUpgradeData from "@/lib/gameplay/dynamicData/planet/buildingUpgradeData";
import * as BuildingEnergySetting from "@/lib/gameplay/dynamicData/planet/buildingEnergySettingData";
import * as BuildingViewHelpers from "@/components/helpers/buildingViewHelpers";

// Energy throttle dropdown. Only shown for built (level >= 1) buildings that produce or consume
// energy. Setting it scales the building's energy prod/cons and its resource production.
function renderEnergySettingDropdown(props: BuildingViewHelpers.BuildingViewProps, selectedPlanetDataPredicted: CoreType.PlanetData, buildingType: GameType.BuildingType, currentLevel: number): ReactElement | null
{
	if (currentLevel < 1)
	{
		return null;
	}

	if (BuildingEnergySetting.buildingHasEnergyPlanetValue(buildingType) === false)
	{
		return null;
	}

	const planetId: number = selectedPlanetDataPredicted.planetRow.id;
	const currentEnergyPercentage: number = BuildingEnergySetting.getBuildingEnergyPercentage(selectedPlanetDataPredicted, buildingType);

	const percentageOptions: number[] = [];
	for (let percentage: number = 0; percentage <= BuildingEnergySetting.FULL_ENERGY_PERCENTAGE; percentage = percentage + BuildingEnergySetting.ENERGY_PERCENTAGE_STEP)
	{
		percentageOptions.push(percentage);
	}

	const handleEnergyPercentageChange = (event: ChangeEvent<HTMLSelectElement>): void =>
	{
		const newEnergyPercentage: number = Number(event.target.value);
		ClientRequestFunctions.clientTrySetBuildingEnergySettingRequest(props.clientDataStateResult.psController, planetId, buildingType, newEnergyPercentage);
	};

	const dropdownElement: ReactElement =
	(
		<div className="flex flex-row items-center gap-1 text-sm mt-1">
			<span>Energy:</span>
			<select
				value={currentEnergyPercentage}
				onChange={handleEnergyPercentageChange}
				className="border border-gray-400 rounded px-1 py-0.5 bg-white text-black"
			>
				{percentageOptions.map((percentage: number): ReactElement =>
				{
					return <option key={percentage} value={percentage}>{percentage}%</option>;
				})}
			</select>
		</div>
	);

	return dropdownElement;
}

function renderBuildingRow(props: BuildingViewHelpers.BuildingViewProps, selectedPlanetDataPredicted: CoreType.PlanetData, buildingType: GameType.BuildingType): ReactElement
{
	const playerData: CoreType.PlayerData = props.clientDataStateResult.psController[0].predictedDBData;
	const planetId: number = selectedPlanetDataPredicted.planetRow.id;

	const displayName: string = ThingDataHelpers.getSpecificThingName(ThingHelpers.building(buildingType));
	const currentLevel: number = BuildingData.getBuildingLevel(selectedPlanetDataPredicted, buildingType);

	const nextCostMap: Map<GameType.ResourceType, number> | null = BuildingCost.computeBuildingUpgradeCost(currentLevel, buildingType);
	const buildDurationSeconds: number | null = BuildingDuration.computeUpgradeDurationSeconds(currentLevel, buildingType, playerData, planetId, props.clientDataStateResult.sdsController[0]);

	if (nextCostMap === null || buildDurationSeconds === null)
	{
		return (
			<div key={buildingType} className="border border-gray-400 rounded p-4">
				{displayName} (level {currentLevel}): cannot compute upgrade.
			</div>
		);
	}

	const imagePath: string = BuildingViewHelpers.getBuildingImagePath(buildingType, currentLevel);

	const isThisBuildingUpgrading: boolean = BuildingUpgradeData.isBuildingTypeCurrentlyUpgrading(selectedPlanetDataPredicted, buildingType);
	const failedRequirements: RequirementType.Requirement[] = Requirement.getFailedBuildingUpgradeRequirements(playerData, buildingType, planetId);
	const failedRequirementsBox: ReactElement | null = BuildingViewHelpers.renderFailedRequirementsBox(failedRequirements, playerData, planetId);

	const remainingMs: number = BuildingUpgradeData.getBuildingUpgradeRemainingMs(selectedPlanetDataPredicted) ?? 0;
	const canAfford: boolean = BuildingData.canAffordUpgrade(selectedPlanetDataPredicted, buildingType);

	const handleBuyUpgrade: () => void = () =>
	{
		ClientRequestFunctions.clientTryUpgradeBuildingRequest(props.clientDataStateResult.psController, planetId, buildingType);
	};

	const handleCancelUpgrade: () => void = () =>
	{
		ClientRequestFunctions.clientTryCancelBuildingUpgradeRequest(props.clientDataStateResult.psController, planetId);
	};

	const levelLine: ReactElement = isThisBuildingUpgrading === true
		? <div className="text-sm">{"Level"} {currentLevel} {"->"} {"Level"} {currentLevel + 1}</div>
		: <div className="text-sm">Level {currentLevel}</div>;

	const actionElement: ReactElement = isThisBuildingUpgrading === true
		? (
			<div className="w-full px-4 py-2 bg-yellow-600 text-white rounded text-center">
				<div className="font-bold">Building</div>
				<div className="text-xs">Time: {TimeFormat.formatRemainingTimeMs(remainingMs)}</div>
					<button type="button" onClick={handleCancelUpgrade} className="block mx-auto mt-1 text-xs underline hover:text-gray-200">Cancel</button>
			</div>
		)
		: (failedRequirementsBox !== null)
		? failedRequirementsBox
		: (
			<button
				onClick={handleBuyUpgrade}
				disabled={(canAfford === false) || (failedRequirements.length > 0)}
				className="w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed flex flex-col items-center"
			>
				<span className="font-bold">Build Upgrade</span>
				<span className="text-xs">{BuildingViewHelpers.renderCostLine(nextCostMap)}</span>
				<span className="text-xs">Time: {TimeFormat.formatRemainingTimeMs(buildDurationSeconds * 1000)}</span>
			</button>
		);

	const middleColumn: ReactElement =
	(
		<div className="flex flex-col justify-center min-w-48">
			<div className="font-bold">{displayName}</div>
			{levelLine}
			{renderEnergySettingDropdown(props, selectedPlanetDataPredicted, buildingType, currentLevel)}
		</div>
	);

	return BuildingViewHelpers.renderBuildingRowShell(buildingType, imagePath, middleColumn, actionElement);
}

export function BuildingView(props: BuildingViewHelpers.BuildingViewProps): ReactElement
{
	try
	{
		const selectedPlanetDataPredicted: CoreType.PlanetData = SelectedPlanet.getSelectedPlanetDataPredicted(props.clientDataStateResult.psController[0]);
		const selectedZone: GameType.PlanetZone = selectedPlanetDataPredicted.planetRow.zone as GameType.PlanetZone;
		const buildableBuildingTypes: GameType.BuildingType[] = BuildingViewHelpers.getBuildableBuildingTypes(selectedZone);

		const rowElements: ReactElement[] = buildableBuildingTypes.map((buildingType: GameType.BuildingType): ReactElement =>
		{
			return renderBuildingRow(props, selectedPlanetDataPredicted, buildingType);
		});

		const buildingViewElement: ReactElement =
		(
			<div className="flex flex-col gap-2 p-4">
				{rowElements}
			</div>
		);

		return buildingViewElement;
	}
	catch (error: unknown)
	{
		console.error("⚠️:", error);
		return <HelperElements.EmptyElement></HelperElements.EmptyElement>;
	}
}
