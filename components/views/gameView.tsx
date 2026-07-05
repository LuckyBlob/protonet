"use client";

import { ChangeEvent, MouseEvent, ReactElement, useState } from "react";

import * as SelectedPlanet from "@/lib/localStorage/selectedPlanet";
import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as BuildingData from "@/lib/gameplay/dynamicData/planet/buildingData";
import * as BuildingViewHelpers from "@/components/helpers/buildingViewHelpers";
import * as HelperElements from "@/components/helpers/helperElements";
import * as UseClientDataState from "@/lib/use/useClientDataState";

type GameViewProps =
{
	clientDataStateResult: UseClientDataState.ClientDataStateResult;
};

type BuildingPlacement =
{
	centerXPercent: number;
	centerYPercent: number;
	widthPercent: number;
};

type PlacementEntry = [GameType.BuildingType, BuildingPlacement];

type PlacementDraft = Map<GameType.BuildingType, BuildingPlacement>;

type PlacementEditorController =
{
	placements: PlacementDraft;
	selectedBuildingType: GameType.BuildingType | null;
	selectBuilding: (buildingType: GameType.BuildingType) => void;
	updatePlacement: (buildingType: GameType.BuildingType, changes: Partial<BuildingPlacement>) => void;
};

const SHOW_PLACEMENT_EDITOR: boolean = false;

const PLACEMENT_MIN_WIDTH_PERCENT: number = 2;

const PLACEMENT_MAX_WIDTH_PERCENT: number = 40;

const BUILDING_PLACEMENTS: ReadonlyMap<GameType.BuildingType, BuildingPlacement> = new Map(
[
	[GameType.BuildingType.MetalMine, { centerXPercent: 93.8, centerYPercent: 79.5, widthPercent: 15.5 }],
	[GameType.BuildingType.CrystalGrower, { centerXPercent: 26.9, centerYPercent: 49.1, widthPercent: 8.5 }],
	[GameType.BuildingType.DeuteriumSynthesizer, { centerXPercent: 60.2, centerYPercent: 42.2, widthPercent: 5.0 }],
	[GameType.BuildingType.Shipyard, { centerXPercent: 44.4, centerYPercent: 64.5, widthPercent: 9.0 }],
	[GameType.BuildingType.ResearchLab, { centerXPercent: 90.1, centerYPercent: 36.2, widthPercent: 8.5 }],
]);

const BUILDING_TYPE_NAMES: ReadonlyMap<GameType.BuildingType, string> = buildBuildingTypeNames();

function buildBuildingTypeNames(): ReadonlyMap<GameType.BuildingType, string>
{
	const buildingTypeNames: Map<GameType.BuildingType, string> = new Map();
	const buildingTypeEntries: [string, unknown][] = Object.entries(GameType.BuildingType);

	for (const [buildingTypeName, buildingTypeValue] of buildingTypeEntries)
	{
		buildingTypeNames.set(buildingTypeValue as GameType.BuildingType, buildingTypeName);
	}

	return buildingTypeNames;
}

function usePlacementEditor(): PlacementEditorController
{
	const [placements, setPlacements] = useState<PlacementDraft>((): PlacementDraft =>
	{
		const initialPlacements: PlacementDraft = new Map();

		for (const [buildingType, placement] of BUILDING_PLACEMENTS)
		{
			initialPlacements.set(buildingType, { ...placement });
		}

		return initialPlacements;
	});

	const [selectedBuildingType, setSelectedBuildingType] = useState<GameType.BuildingType | null>(null);

	const selectBuilding = (buildingType: GameType.BuildingType): void =>
	{
		setSelectedBuildingType(buildingType);
	};

	const updatePlacement = (buildingType: GameType.BuildingType, changes: Partial<BuildingPlacement>): void =>
	{
		setPlacements((previousPlacements: PlacementDraft): PlacementDraft =>
		{
			const existingPlacement: BuildingPlacement | undefined = previousPlacements.get(buildingType);

			if (existingPlacement === undefined)
			{
				return previousPlacements;
			}

			const nextPlacements: PlacementDraft = new Map(previousPlacements);
			const updatedPlacement: BuildingPlacement =
			{
				centerXPercent: changes.centerXPercent ?? existingPlacement.centerXPercent,
				centerYPercent: changes.centerYPercent ?? existingPlacement.centerYPercent,
				widthPercent: changes.widthPercent ?? existingPlacement.widthPercent,
			};
			nextPlacements.set(buildingType, updatedPlacement);

			return nextPlacements;
		});
	};

	const placementEditorController: PlacementEditorController =
	{
		placements: placements,
		selectedBuildingType: selectedBuildingType,
		selectBuilding: selectBuilding,
		updatePlacement: updatePlacement,
	};

	return placementEditorController;
}

function buildPlacementEntriesBackToFront(placements: PlacementDraft): PlacementEntry[]
{
	const placementEntries: PlacementEntry[] = [];

	for (const [buildingType, placement] of placements)
	{
		placementEntries.push([buildingType, placement]);
	}

	placementEntries.sort((first: PlacementEntry, second: PlacementEntry): number =>
	{
		return first[1].centerYPercent - second[1].centerYPercent;
	});

	return placementEntries;
}

function logPlacementsToConsole(placements: PlacementDraft): void
{
	const placementLines: string[] = [];

	for (const [buildingType, defaultPlacement] of BUILDING_PLACEMENTS)
	{
		const currentPlacement: BuildingPlacement = placements.get(buildingType) ?? defaultPlacement;
		const buildingTypeName: string = BUILDING_TYPE_NAMES.get(buildingType) ?? `${buildingType}`;
		const placementLine: string = `\t[GameType.BuildingType.${buildingTypeName}, { centerXPercent: ${currentPlacement.centerXPercent.toFixed(1)}, centerYPercent: ${currentPlacement.centerYPercent.toFixed(1)}, widthPercent: ${currentPlacement.widthPercent.toFixed(1)} }],`;
		placementLines.push(placementLine);
	}

	const placementBlock: string = placementLines.join("\n");
	console.error("⚠️:", `\n${placementBlock}`);
}

function renderPlacedBuilding(buildingType: GameType.BuildingType, buildingLevel: number, placement: BuildingPlacement, isSelected: boolean): ReactElement
{
	const imagePath: string = BuildingViewHelpers.getBuildingImagePath(buildingType, buildingLevel);
	const selectionClassName: string = isSelected === true ? " outline outline-2 outline-cyan-400" : "";

	const placedBuildingElement: ReactElement =
	(
		<img
			key={buildingType}
			src={imagePath}
			alt=""
			className={`absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none select-none${selectionClassName}`}
			style=
			{{
				left: `${placement.centerXPercent}%`,
				top: `${placement.centerYPercent}%`,
				width: `${placement.widthPercent}%`,
			}}
			onError={(event) =>
			{
				(event.currentTarget as HTMLImageElement).style.display = "none";
			}}
		/>
	);

	return placedBuildingElement;
}

function renderPlacedBuildings(selectedPlanetDataPredicted: CoreType.PlanetData, controller: PlacementEditorController): ReactElement[]
{
	const placementEntries: PlacementEntry[] = buildPlacementEntriesBackToFront(controller.placements);

	const placedBuildingElements: ReactElement[] = [];

	for (const [buildingType, placement] of placementEntries)
	{
		const buildingLevel: number = BuildingData.getBuildingLevel(selectedPlanetDataPredicted, buildingType);

		if (buildingLevel === 0)
		{
			continue;
		}

		const isSelected: boolean = controller.selectedBuildingType === buildingType;
		const placedBuildingElement: ReactElement = renderPlacedBuilding(buildingType, buildingLevel, placement, isSelected);
		placedBuildingElements.push(placedBuildingElement);
	}

	return placedBuildingElements;
}

function renderPlacementEditorRow(buildingType: GameType.BuildingType, placement: BuildingPlacement, isSelected: boolean, controller: PlacementEditorController): ReactElement
{
	const iconPath: string = BuildingViewHelpers.getBuildingImagePath(buildingType, 1);

	const handleSelectClick = (): void =>
	{
		controller.selectBuilding(buildingType);
	};

	const handleWidthChange = (event: ChangeEvent<HTMLInputElement>): void =>
	{
		const nextWidthPercent: number = Number(event.target.value);
		controller.updatePlacement(buildingType, { widthPercent: nextWidthPercent });
	};

	const rowClassName: string = isSelected === true ? "flex flex-row items-center gap-2 rounded bg-cyan-500/30 px-1" : "flex flex-row items-center gap-2 px-1";

	const editorRowElement: ReactElement =
	(
		<div key={buildingType} className={rowClassName}>
			<button type="button" onClick={handleSelectClick} className="shrink-0">
				<img src={iconPath} alt="" className="w-8 h-8 object-contain" />
			</button>
			<input
				type="range"
				min={PLACEMENT_MIN_WIDTH_PERCENT}
				max={PLACEMENT_MAX_WIDTH_PERCENT}
				step={0.5}
				value={placement.widthPercent}
				onChange={handleWidthChange}
			/>
			<span className="w-24 text-right tabular-nums">{placement.centerXPercent.toFixed(1)}, {placement.centerYPercent.toFixed(1)}, {placement.widthPercent.toFixed(1)}</span>
		</div>
	);

	return editorRowElement;
}

function renderPlacementEditor(controller: PlacementEditorController): ReactElement
{
	const editorRowElements: ReactElement[] = [];

	for (const [buildingType, placement] of controller.placements)
	{
		const isSelected: boolean = controller.selectedBuildingType === buildingType;
		const editorRowElement: ReactElement = renderPlacementEditorRow(buildingType, placement, isSelected, controller);
		editorRowElements.push(editorRowElement);
	}

	const handleLogClick = (): void =>
	{
		logPlacementsToConsole(controller.placements);
	};

	const editorElement: ReactElement =
	(
		<div className="flex flex-col gap-1 self-start rounded bg-black/75 p-2 text-xs text-white">
			<span className="font-semibold">Placement editor (dev)</span>
			<span className="opacity-80">Click a building icon to select, then click the planet to move it. Slider sizes it.</span>
			{editorRowElements}
			<button type="button" onClick={handleLogClick} className="mt-1 rounded bg-cyan-600 px-2 py-1 font-semibold">
				Log values to console
			</button>
		</div>
	);

	return editorElement;
}

function handleEditorMapClick(event: MouseEvent<HTMLImageElement>, controller: PlacementEditorController): void
{
	if (SHOW_PLACEMENT_EDITOR === false)
	{
		return;
	}

	const selectedBuildingType: GameType.BuildingType | null = controller.selectedBuildingType;

	if (selectedBuildingType === null)
	{
		return;
	}

	const bounds: DOMRect = event.currentTarget.getBoundingClientRect();
	const centerXPercent: number = ((event.clientX - bounds.left) / bounds.width) * 100;
	const centerYPercent: number = ((event.clientY - bounds.top) / bounds.height) * 100;

	controller.updatePlacement(selectedBuildingType, { centerXPercent: centerXPercent, centerYPercent: centerYPercent });
}

function renderGameViewBody(selectedPlanetDataPredicted: CoreType.PlanetData, controller: PlacementEditorController): ReactElement
{
	const placedBuildingElements: ReactElement[] = renderPlacedBuildings(selectedPlanetDataPredicted, controller);
	const editorElement: ReactElement | null = SHOW_PLACEMENT_EDITOR === true ? renderPlacementEditor(controller) : null;

	const gameViewBodyElement: ReactElement =
	(
		<div className="w-full max-w-5xl mx-auto flex flex-col gap-2">
			<div className="relative aspect-[1584/672] overflow-hidden rounded-lg">
				<img
					src="/planet/overview.png"
					alt=""
					className="absolute inset-0 w-full h-full object-cover select-none"
					onClick={(event: MouseEvent<HTMLImageElement>): void => handleEditorMapClick(event, controller)}
				/>
				{placedBuildingElements}
			</div>
			{editorElement}
		</div>
	);

	return gameViewBodyElement;
}

export function GameView(props: GameViewProps): ReactElement
{
	const placementEditorController: PlacementEditorController = usePlacementEditor();

	try
	{
		const selectedPlanetDataPredicted: CoreType.PlanetData = SelectedPlanet.getSelectedPlanetDataPredicted(props.clientDataStateResult.psController[0]);
		const gameViewBodyElement: ReactElement = renderGameViewBody(selectedPlanetDataPredicted, placementEditorController);

		return gameViewBodyElement;
	}
	catch (error: unknown)
	{
		console.error("⚠️:", error);

		return <HelperElements.EmptyElement />;
	}
}
