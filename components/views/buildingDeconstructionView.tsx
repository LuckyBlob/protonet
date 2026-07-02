"use client";

import { ReactElement } from "react";

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
import * as StaticDataHelper from "@/lib/gameplay/coreData/static/staticDataHelpers";
import * as BuildingData from "@/lib/gameplay/dynamicData/planet/buildingData";
import * as BuildingCost from "@/lib/gameplay/coreData/formula/buildingCostFormulas";
import * as BuildingDeconstructionData from "@/lib/gameplay/dynamicData/planet/buildingDeconstructionData";
import * as BuildingViewHelpers from "@/components/helpers/buildingViewHelpers";

function renderBuildingDeconstructRow(props: BuildingViewHelpers.BuildingViewProps, selectedPlanetDataPredicted: CoreType.PlanetData, buildingType: GameType.BuildingType): ReactElement
{
	const playerData: CoreType.PlayerData = props.clientDataStateResult.psController[0].predictedDBData;
	const planetId: number = selectedPlanetDataPredicted.planetRow.id;

	const displayName: string = ThingDataHelpers.getSpecificThingName(ThingHelpers.building(buildingType));
	const currentLevel: number = BuildingData.getBuildingLevel(selectedPlanetDataPredicted, buildingType);

	const deconstructionCostMap: Map<GameType.ResourceType, number> | null = BuildingCost.computeBuildingDeconstructionCost(currentLevel, buildingType, playerData);
	const deconstructionDurationSeconds: number | null = BuildingDeconstructionData.getBuildingDeconstructionDurationSeconds(playerData, buildingType, selectedPlanetDataPredicted, props.clientDataStateResult.sdsController[0]);

	const imagePath: string = BuildingViewHelpers.getBuildingImagePath(buildingType, currentLevel);

	const isThisBuildingDeconstructing: boolean = BuildingDeconstructionData.isBuildingTypeCurrentlyDeconstructing(selectedPlanetDataPredicted, buildingType);
	const remainingMs: number = BuildingDeconstructionData.getBuildingDeconstructionRemainingMs(selectedPlanetDataPredicted) ?? 0;
	const canAfford: boolean = (deconstructionCostMap !== null) && BuildingData.canAffordResourceCost(selectedPlanetDataPredicted, deconstructionCostMap);

	const failedRequirements: RequirementType.Requirement[] = Requirement.getFailedBuildingDeconstructionRequirements(playerData, buildingType, planetId);
	const failedRequirementsBox: ReactElement | null = BuildingViewHelpers.renderFailedRequirementsBox(failedRequirements, playerData, planetId);

	const handleDeconstruct: () => void = () =>
	{
		ClientRequestFunctions.clientTryDeconstructBuildingRequest(props.clientDataStateResult.psController, planetId, buildingType);
	};

	const handleCancelDeconstruct: () => void = () =>
	{
		ClientRequestFunctions.clientTryCancelBuildingDeconstructionRequest(props.clientDataStateResult.psController, planetId);
	};

	const levelLine: ReactElement = isThisBuildingDeconstructing === true
		? <div className="text-sm">{"Level"} {currentLevel} {"->"} {"Level"} {currentLevel - 1}</div>
		: <div className="text-sm">Level {currentLevel}</div>;

	const actionElement: ReactElement = isThisBuildingDeconstructing === true
		? (
			<div className="w-full px-4 py-2 bg-orange-700 text-white rounded text-center">
				<div className="font-bold">Deconstructing</div>
				<div className="text-xs">Time: {TimeFormat.formatRemainingTimeMs(remainingMs)}</div>
					<button type="button" onClick={handleCancelDeconstruct} className="block mx-auto mt-1 text-xs underline hover:text-gray-200">Cancel</button>
			</div>
		)
		: (failedRequirementsBox !== null)
		? failedRequirementsBox
		: (deconstructionCostMap === null || deconstructionDurationSeconds === null)
		? (
			<div className="w-full px-4 py-2 bg-gray-600 text-white rounded text-center">
				<div className="text-xs">Cannot deconstruct.</div>
			</div>
		)
		: (
			<button
				onClick={handleDeconstruct}
				disabled={(canAfford === false) || (failedRequirements.length > 0)}
				className="w-full px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex flex-col items-center"
			>
				<span className="font-bold">Deconstruct</span>
				<span className="text-xs">{BuildingViewHelpers.renderCostLine(deconstructionCostMap)}</span>
				<span className="text-xs">Time: {TimeFormat.formatRemainingTimeMs(deconstructionDurationSeconds * 1000)}</span>
			</button>
		);

	const middleColumn: ReactElement =
	(
		<div className="flex flex-col justify-center min-w-48">
			<div className="font-bold">{displayName}</div>
			{levelLine}
		</div>
	);

	return BuildingViewHelpers.renderBuildingRowShell(buildingType, imagePath, middleColumn, actionElement);
}

export function BuildingDeconstructionView(props: BuildingViewHelpers.BuildingViewProps): ReactElement
{
	try
	{
		const selectedPlanetDataPredicted: CoreType.PlanetData = SelectedPlanet.getSelectedPlanetDataPredicted(props.clientDataStateResult.psController[0]);
		const selectedZone: GameType.PlanetZone = selectedPlanetDataPredicted.planetRow.zone as GameType.PlanetZone;

		const deconstructableBuildingTypes: GameType.BuildingType[] = BuildingViewHelpers.getBuildableBuildingTypes(selectedZone).filter((buildingType: GameType.BuildingType): boolean =>
		{
			return (BuildingData.getBuildingLevel(selectedPlanetDataPredicted, buildingType) >= 1) && (StaticDataHelper.canDeconstructBuilding(buildingType) === true);
		});

		const rowElements: ReactElement[] = deconstructableBuildingTypes.map((buildingType: GameType.BuildingType): ReactElement =>
		{
			return renderBuildingDeconstructRow(props, selectedPlanetDataPredicted, buildingType);
		});

		const emptyElement: ReactElement | null = (rowElements.length === 0)
			? <div className="border border-gray-400 rounded p-4 text-gray-400 text-center">Nothing to deconstruct.</div>
			: null;

		const buildingDeconstructionViewElement: ReactElement =
		(
			<div className="flex flex-col gap-2 p-4">
				{rowElements}
				{emptyElement}
			</div>
		);

		return buildingDeconstructionViewElement;
	}
	catch (error: unknown)
	{
		console.error("⚠️:", error);
		return <HelperElements.EmptyElement></HelperElements.EmptyElement>;
	}
}
