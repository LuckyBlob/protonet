"use client";

import { useState, useEffect, ChangeEvent, ReactElement } from "react";

import * as TimeFormat from "@/lib/helper/timeFormat";
import * as SelectedPlanet from "@/lib/localStorage/selectedPlanet";
import * as UseClientDataState from "@/lib/use/useClientDataState";
import * as ClientRequestFunctions from "@/lib/networkRequests/client/clientRequestFunctions";
import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as UnitData from "@/lib/gameplay/dynamicData/planet/unitData";
import * as HelperElements from "@/components/helpers/helperElements";
import * as ThingType from "@/lib/gameplay/coreData/thing/thingTypes";
import * as ThingHelpers from "@/lib/gameplay/coreData/thing/thingHelpers";
import * as ThingDataHelpers from "@/lib/gameplay/coreData/thing/thingDataHelpers";
import * as StaticDataHelper from "@/lib/gameplay/coreData/static/staticDataHelpers";
import * as Requirement from "@/lib/gameplay/coreData/requirement/requirements";
import * as RequirementType from "@/lib/gameplay/coreData/requirement/requirementTypes";
import * as HelperElement from "@/components/helpers/helperElements";
import * as UnitConstructionData from "@/lib/gameplay/dynamicData/planet/unitConstructionData";
import * as DBType from "@/lib/db/dbTypes";

const PREVIEW_MAX_UNIT_LINES: number = 7;
const PREVIEW_MAX_RESOURCE_LINES: number = 7;
const PREVIEW_TEXT_LINE_HEIGHT_PX: number = 20;
const PREVIEW_TOTAL_TIME_LINE_PX: number = 20;
const PREVIEW_COUNTDOWN_LINE_PX: number = 20;
const PREVIEW_BUTTON_PX: number = 40;
const PREVIEW_BOX_VERTICAL_PADDING_PX: number = 32;
const PREVIEW_STACK_GAPS_PX: number = 32;

const PREVIEW_RESERVE_HEIGHT_PX =
    (PREVIEW_MAX_UNIT_LINES * PREVIEW_TEXT_LINE_HEIGHT_PX)
    + (PREVIEW_MAX_RESOURCE_LINES * PREVIEW_TEXT_LINE_HEIGHT_PX)
    + PREVIEW_TOTAL_TIME_LINE_PX
    + PREVIEW_COUNTDOWN_LINE_PX
    + PREVIEW_BUTTON_PX
    + PREVIEW_BOX_VERTICAL_PADDING_PX
    + PREVIEW_STACK_GAPS_PX;

type ShipyardViewProps =
{
    clientDataStateResult: UseClientDataState.ClientDataStateResult;
};

//#region pure helpers
function buildSingleUnitCostParts(unitType: GameType.UnitType): string[]
{
    const singleCostMap: Map<GameType.ResourceType, number> | null = UnitConstructionData.getSingleUnitCost(unitType);

    if (singleCostMap === null)
    {
        return [];
    }

    return HelperElement.buildCostParts(singleCostMap);
}

function buildRequestedQuantitiesMap(unitTypes: GameType.UnitType[], requestedQuantities: Map<GameType.UnitType, number>): Map<GameType.UnitType, number>
{
    const requestedMap: Map<GameType.UnitType, number> = new Map<GameType.UnitType, number>();

    for (const unitType of unitTypes)
    {
        const requestedQuantity: number = requestedQuantities.get(unitType) ?? 0;

        if (requestedQuantity <= 0)
        {
            continue;
        }

        requestedMap.set(unitType, requestedQuantity);
    }

    return requestedMap;
}
//#endregion

//#region rendering helpers
function renderQuantityInput(props: ShipyardViewProps, unitType: GameType.UnitType, requestedQuantity: number, planetData: CoreType.PlanetData, setRequestedQuantity: (unitType: GameType.UnitType, value: number) => void): ReactElement
{
    const playerData: CoreType.PlayerData = props.clientDataStateResult.psController[0].predictedDBData;
    const planetId: number = planetData.planetRow.id;

    let element: ReactElement | null = null;

    const failedUnitRequirements: RequirementType.Requirement[] = Requirement.getFailedUnitBuildRequirements(playerData, unitType, planetId);
    if (failedUnitRequirements.length > 0)
    {
        const requirements: string[] = Requirement.getRequirementDescriptions(failedUnitRequirements, playerData, planetId);

        const element: ReactElement =
        (
            <div>
                {requirements.map((requirement: string) =>
                {
                    return <div key={requirement}>{requirement}</div>;
                })}
            </div>
        );

        return element;
    }
    else
    {
        const handleQuantityChange = (e: ChangeEvent<HTMLInputElement>): void =>
        {
            const parsedValue: number = Number.parseInt(e.target.value, 10);

            if (Number.isNaN(parsedValue) || parsedValue < 0)
            {
                setRequestedQuantity(unitType, 0);
                return;
            }

            setRequestedQuantity(unitType, parsedValue);
        };

        const element: ReactElement =
        (
            <input
                type="number"
                min={0}
                value={requestedQuantity}
                onChange={handleQuantityChange}
                className="border border-gray-400 px-2 py-1 rounded bg-white text-black w-24"
            />
        );

        return element;
    }
}

function renderUnitBuildRow(props: ShipyardViewProps, planetData: CoreType.PlanetData, serverData: CoreType.ServerData, unitType: GameType.UnitType, requestedQuantity: number, setRequestedQuantity: (unitType: GameType.UnitType, value: number) => void): ReactElement
{
    const unitName: string = ThingDataHelpers.getSpecificThingName(ThingHelpers.unit(unitType));
    const ownedQuantity: number = UnitData.getUnitQuantity(planetData, unitType);
    const singleDurationSeconds: number = UnitConstructionData.getUnitConstructionDurationSeconds(unitType, planetData, serverData) ?? 0;
    const costParts: string[] = buildSingleUnitCostParts(unitType);

    const element: ReactElement =
    (
        <div key={unitType} className="flex flex-row items-center border border-gray-400 rounded">
            <div className="flex items-center justify-center px-4 py-3 border-r border-gray-400">
                {HelperElement.renderUnitImage(unitType)}
            </div>

            <div className="flex flex-col px-4 py-3 border-r border-gray-400 min-w-[200px]">
                <div className="font-bold">{unitName}</div>
                <div className="text-xs">Time: {TimeFormat.formatRemainingTimeMs(singleDurationSeconds * 1000)}</div>
                <div className="text-xs">Cost: {costParts.join(" / ")}</div>
            </div>

            <div className="flex items-center justify-center px-4 py-3 border-r border-gray-400 min-w-[100px]">
                <div className="text-sm">{ownedQuantity} owned</div>
            </div>

            <div className="flex items-center justify-center px-4 py-3 min-w-[140px]">
                {renderQuantityInput(props, unitType, requestedQuantity, planetData, setRequestedQuantity)}
            </div>
        </div>
    );

    return element;
}

function renderUnitBuildRows(props: ShipyardViewProps, unitTypes: GameType.UnitType[], planetData: CoreType.PlanetData, serverData: CoreType.ServerData, requestedQuantities: Map<GameType.UnitType, number>, setRequestedQuantity: (unitType: GameType.UnitType, value: number) => void): ReactElement
{
    const rowElements: ReactElement[] = unitTypes.map((unitType: GameType.UnitType) =>
    {
        const requestedQuantity: number = requestedQuantities.get(unitType) ?? 0;

        return renderUnitBuildRow(props, planetData, serverData, unitType, requestedQuantity, setRequestedQuantity);
    });

    const element: ReactElement =
    (
        <div className="text-sm font-semibold text-white whitespace-nowrap inline-block">
            {rowElements}
        </div>
    );

    return element;
}

function renderActiveConstructionHeader(unitConstruction: CoreType.UnitConstruction): ReactElement | null
{
    const currentUnitRow: DBType.UnitConstructionUnitRow | undefined = unitConstruction.unitConstructionUnitRows.find(
        (row: DBType.UnitConstructionUnitRow): boolean => row.id === unitConstruction.unitConstructionRow.current_unit_construction_unit_row_id
    );

    if (currentUnitRow === undefined)
    {
        return null;
    }

    const currentUnitName: string = ThingDataHelpers.getSpecificThingName(ThingHelpers.unit(currentUnitRow.unit_type));

    const element: ReactElement =
    (
        <div className="text-xs font-semibold text-yellow-400">Building: {currentUnitName}</div>
    );

    return element;
}

function renderActiveConstructionSection(selectedPlanetDataPredicted: CoreType.PlanetData, serverData: CoreType.ServerData): ReactElement
{
    const unitConstructions: CoreType.UnitConstruction[] = selectedPlanetDataPredicted.dynamicPlanetData.unitConstructions;

    if (unitConstructions.length === 0)
    {
        const emptyElement: ReactElement =
        (
            <div className="border border-gray-400 rounded px-6 py-4 text-sm text-center w-full">
                No unit construction in progress.
            </div>
        );

        return emptyElement;
    }

    const sortedConstructions: CoreType.UnitConstruction[] = [...unitConstructions].sort(
        (a: CoreType.UnitConstruction, b: CoreType.UnitConstruction): number =>
        {
            const aIsStarted: boolean = a.unitConstructionRow.started_at !== null;
            const bIsStarted: boolean = b.unitConstructionRow.started_at !== null;

            if (aIsStarted === true && bIsStarted === false)
            {
                return -1;
            }

            if (aIsStarted === false && bIsStarted === true)
            {
                return 1;
            }

            return 0;
        }
    );

    const remainingMs: number = UnitConstructionData.getUnitConstructionRemainingMs(selectedPlanetDataPredicted) ?? 0;

    const rowElements: ReactElement[] = sortedConstructions.map((unitConstruction: CoreType.UnitConstruction, index: number): ReactElement =>
    {
        const isActive: boolean = index === 0 && unitConstruction.unitConstructionRow.started_at !== null;
        return renderRow(selectedPlanetDataPredicted, unitConstruction, serverData, isActive, remainingMs);
    });

    const element: ReactElement =
    (
        <div className="flex flex-col gap-2 w-full">
            {rowElements}
        </div>
    );

    return element;
}

function renderRow(planetData: CoreType.PlanetData, unitConstruction: CoreType.UnitConstruction, serverData: CoreType.ServerData, isActive: boolean, remainingMs: number): ReactElement
{
    const headerElement: ReactElement | null = isActive === true ? renderActiveConstructionHeader(unitConstruction) : null;
    const timerElement: ReactElement = renderTimer(isActive, remainingMs, unitConstruction.unitConstructionRow.duration_at_request_time);

    const element: ReactElement =
    (
        <div key={unitConstruction.unitConstructionRow.id} className="flex flex-row border border-gray-400 rounded w-full h-24">
            <div className="flex flex-col gap-1 px-6 py-3 border-r border-gray-400 flex-1 min-w-[160px] overflow-y-auto">
                {headerElement}
                {renderUnitLines(planetData, unitConstruction, serverData)}
            </div>
            <div className="flex items-center justify-center px-6 py-3 w-[140px] shrink-0">
                {timerElement}
            </div>
        </div>
    );

    return element;
}

function renderTimer(isActive: boolean, remainingMs: number, durationAtRequestTimeMs: number): ReactElement
{
    if (isActive === true)
    {
        const activeElement: ReactElement =
        (
            <div className="text-sm font-semibold text-yellow-400">
                {TimeFormat.formatRemainingTimeMs(remainingMs)}
            </div>
        );

        return activeElement;
    }

    const idleElement: ReactElement =
    (
        <div className="flex flex-col items-center text-xs text-gray-400 text-center">
            <div>Total at request:</div>
            <div>{TimeFormat.formatRemainingTimeMs(durationAtRequestTimeMs)}</div>
        </div>
    );

    return idleElement;
}

function renderUnitLines(planetData: CoreType.PlanetData, unitConstruction: CoreType.UnitConstruction, serverData: CoreType.ServerData): ReactElement[]
{
    UnitConstructionData.sortUnitConstructionUnitRowByConstructionTime(planetData, unitConstruction, serverData);
    const lineElements: ReactElement[] = [];

    for (const unitRow of unitConstruction.unitConstructionUnitRows)
    {
        const unitName: string = ThingDataHelpers.getSpecificThingName(ThingHelpers.unit(unitRow.unit_type));

        lineElements.push(
            <div key={unitRow.unit_type} className="text-sm">
                {unitName} x {unitRow.unit_quantity}
            </div>
        );
    }

    return lineElements;
}

function renderBuildableUnitLines(buildableQuantities: Map<GameType.UnitType, number>): ReactElement
{
    const unitLineElements: ReactElement[] = [];

    for (const [unitType, unitQuantity] of buildableQuantities)
    {
        if (unitQuantity <= 0)
        {
            continue;
        }

        unitLineElements.push(
            <div key={unitType} className="text-sm">
                {ThingDataHelpers.getSpecificThingName(ThingHelpers.unit(unitType))} x {unitQuantity}
            </div>
        );
    }

    const element: ReactElement =
    (
        <div className="contents">
            {unitLineElements}
        </div>
    );

    return element;
}

function renderBuildableResourceLines(totalCost: Map<GameType.ResourceType, number>): ReactElement
{
    const resourceLineElements: ReactElement[] = [];

    for (const [resourceType, resourceCost] of totalCost)
    {
        resourceLineElements.push
        (
            <div key={resourceType} className="text-sm text-blue-400">
                {resourceCost} {ThingDataHelpers.getSpecificThingName(ThingHelpers.resource(resourceType))}
            </div>
        );
    }

    const element: ReactElement =
    (
        <div className="contents">
            {resourceLineElements}
        </div>
    );

    return element;
}

function renderBuildPreviewContent(planetData: CoreType.PlanetData, serverData: CoreType.ServerData, requestedMap: Map<GameType.UnitType, number>): ReactElement | null
{
    if (requestedMap.size === 0)
    {
        return null;
    }

    const buildableQuantities: Map<GameType.UnitType, number> = UnitConstructionData.computeMaxAffordableUnitQuantities(planetData, requestedMap);

    if (buildableQuantities.size === 0)
    {
        return (
            <div className="border border-gray-400 rounded px-6 py-4 text-center w-80">
                Rien, esti de pauvre.
            </div>
        );
    }

    const totalDurationSeconds: number = UnitConstructionData.computeUnitQuantitiesConstructionDurationSeconds(buildableQuantities, planetData, serverData);
    const totalCost: Map<GameType.ResourceType, number> = UnitConstructionData.computeUnitConstructionCost(buildableQuantities);

    const element: ReactElement =
    (
        <div className="border border-gray-400 rounded px-6 py-4 flex flex-col items-center gap-2 w-80 bg-black">
            <div className="flex flex-col items-center gap-1">
                {renderBuildableUnitLines(buildableQuantities)}
            </div>

            <div className="flex flex-col items-center gap-1">
                {renderBuildableResourceLines(totalCost)}
            </div>

            <div className="text-sm font-semibold">
                Total time: {TimeFormat.formatRemainingTimeMs(totalDurationSeconds * 1000)}
            </div>
        </div>
    );

    return element;
}

function renderBuildButton(planetData: CoreType.PlanetData, serverData: CoreType.ServerData, requestedMap: Map<GameType.UnitType, number>, hasRequestedData: boolean, onBuildAll: () => void): ReactElement | null
{
    if (hasRequestedData === false)
    {
        return null;
    }

    const buildableQuantities: Map<GameType.UnitType, number> = UnitConstructionData.computeMaxAffordableUnitQuantities(planetData, requestedMap);

    const element: ReactElement =
    (
        <button
            onClick={onBuildAll}
			disabled={buildableQuantities.size === 0}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
            Build all
        </button>
    );

    return element;
}

function renderShipyardLayout(previewSlot: ReactElement, buildRowElements: ReactElement, activeConstructionElements: ReactElement): ReactElement
{
    const element: ReactElement =
    (
        <div className="w-full flex flex-col items-center justify-center gap-4">
            <div
                className="w-full flex flex-col items-center justify-center shrink-0"
                style={{ height: `${PREVIEW_RESERVE_HEIGHT_PX}px` }}
            >
                {previewSlot}
            </div>

            <div className="w-full flex flex-col items-center pt-4">
                <div className="flex flex-row items-stretch justify-center gap-8">
                    <div className="flex flex-col gap-2 min-w-[320px]">
                        <div className="relative flex flex-col gap-2 items-center">
                            {buildRowElements}
                        </div>
                    </div>

                    <div className="w-px bg-gray-400 self-stretch my-0" />

                    <div className="flex flex-col gap-2 min-w-[320px]">
                        {activeConstructionElements}
                    </div>
                </div>
            </div>
        </div>
    );

    return element;
}

function renderPreviewSlot(previewContent: ReactElement | null, buildButton: ReactElement | null): ReactElement
{
    const element: ReactElement =
    (
        <div className="flex flex-col items-center justify-center gap-4">
            {previewContent}
            {buildButton}
        </div>
    );

    return element;
}
//#endregion

//#region state + handlers
function createBuildUnitsHandler(props: ShipyardViewProps, planetData: CoreType.PlanetData, requestedQuantities: Map<GameType.UnitType, number>, resetRequestedQuantities: () => void): () => void
{
    return () =>
    {
        ClientRequestFunctions.clientTryBuildUnitsRequest(props.clientDataStateResult.psController, planetData.planetRow.id, requestedQuantities);
        resetRequestedQuantities();
    };
}
//#endregion

function renderShipyardBody(props: ShipyardViewProps, planetDataPredicted: CoreType.PlanetData, quantitiesState: HelperElement.RequestedQuantitiesState<GameType.UnitType>): ReactElement
{
    const serverData: CoreType.ServerData = props.clientDataStateResult.sdsController[0];
    const unitTypes: GameType.UnitType[] = StaticDataHelper.getAllSpecificThings(ThingType.Thing.Unit);

    const requestedMap: Map<GameType.UnitType, number> = buildRequestedQuantitiesMap(unitTypes, quantitiesState.requestedQuantities);
    const hasRequestedData: boolean = requestedMap.size > 0;

    const onBuildAll: () => void = createBuildUnitsHandler(props, planetDataPredicted, requestedMap, quantitiesState.resetRequestedQuantities);

    const previewContent: ReactElement | null = renderBuildPreviewContent(planetDataPredicted, serverData, requestedMap);
    const buildButton: ReactElement | null = renderBuildButton(planetDataPredicted, serverData, requestedMap, hasRequestedData, onBuildAll);
    const previewSlot: ReactElement = renderPreviewSlot(previewContent, buildButton);
    const buildRowElements: ReactElement = renderUnitBuildRows(props, unitTypes, planetDataPredicted, serverData, quantitiesState.requestedQuantities, quantitiesState.setRequestedQuantity);
    const activeConstructionElements: ReactElement = renderActiveConstructionSection(planetDataPredicted, serverData);

    return renderShipyardLayout(previewSlot, buildRowElements, activeConstructionElements);
}

export function ShipyardView(props: ShipyardViewProps): ReactElement
{
    const quantitiesState: HelperElement.RequestedQuantitiesState<GameType.UnitType> = HelperElement.useRequestedQuantities<GameType.UnitType>();
    const selectedPlanetId: number = props.clientDataStateResult.psController[0].selectedPlanetId;

    useEffect((): void =>
    {
        quantitiesState.resetRequestedQuantities();
    }, [selectedPlanetId]);

    try
    {
        const selectedPlanetDataPredicted: CoreType.PlanetData = SelectedPlanet.getSelectedPlanetDataPredicted(props.clientDataStateResult.psController[0]);
        return renderShipyardBody(props, selectedPlanetDataPredicted, quantitiesState);
    }
    catch (error: unknown)
    {
        console.error("⚠️:", error);
        return <HelperElements.EmptyElement />;
    }
}
