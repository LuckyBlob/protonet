"use client";

import { useState, useEffect, ChangeEvent, ReactElement } from "react";

import * as TimeFormat from "@/lib/helper/timeFormat";
import * as SelectedPlanet from "@/lib/localStorage/selectedPlanet";
import * as UseClientDataState from "@/lib/use/useClientDataState";
import * as ClientRequestFunctions from "@/lib/networkRequests/client/clientRequestFunctions";
import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as ShipData from "@/lib/gameplay/gameplayData/dynamic/shipData";
import * as HelperElements from "@/components/helperElements";
import * as ThingType from "@/lib/gameplay/coreData/type/thingTypes";
import * as Requirement from "@/lib/gameplay/coreData/requirement/requirements";
import * as RequirementType from "@/lib/gameplay/coreData/requirement/requirementTypes";
import * as HelperElement from "@/components/helperElements";
import * as ShipConstructionData from "@/lib/gameplay/gameplayData/dynamic/shipConstructionData";
import * as DBType from "@/lib/db/dbTypes";

const PREVIEW_MAX_SHIP_LINES: number = 7;
const PREVIEW_MAX_RESOURCE_LINES: number = 7;
const PREVIEW_TEXT_LINE_HEIGHT_PX: number = 20;
const PREVIEW_TOTAL_TIME_LINE_PX: number = 20;
const PREVIEW_COUNTDOWN_LINE_PX: number = 20;
const PREVIEW_BUTTON_PX: number = 40;
const PREVIEW_BOX_VERTICAL_PADDING_PX: number = 32;
const PREVIEW_STACK_GAPS_PX: number = 32;

const PREVIEW_RESERVE_HEIGHT_PX =
    (PREVIEW_MAX_SHIP_LINES * PREVIEW_TEXT_LINE_HEIGHT_PX)
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
function buildSingleShipCostParts(shipType: number): string[]
{
    const singleCostMap: Map<number, number> | null = ShipConstructionData.getSingleShipCost(shipType);

    if (singleCostMap === null)
    {
        return [];
    }

    return HelperElement.buildCostParts(singleCostMap);
}

function buildRequestedQuantitiesMap(shipTypes: number[], requestedQuantities: Map<number, number>): Map<number, number>
{
    const requestedMap: Map<number, number> = new Map<number, number>();

    for (const shipType of shipTypes)
    {
        const requestedQuantity: number = requestedQuantities.get(shipType) ?? 0;

        if (requestedQuantity <= 0)
        {
            continue;
        }

        requestedMap.set(shipType, requestedQuantity);
    }

    return requestedMap;
}
//#endregion

//#region rendering helpers
function renderQuantityInput(props: ShipyardViewProps, shipType: number, requestedQuantity: number, planetData: CoreType.PlanetData, setRequestedQuantity: (shipType: number, value: number) => void): ReactElement
{
    const playerData: CoreType.PlayerData = props.clientDataStateResult.psController[0].predictedDBData;
    const planetId: number = planetData.planetRow.id;

    let element: ReactElement | null = null;

    const failedShipRequirements: RequirementType.Requirement[] = Requirement.getFailedShipBuildRequirements(playerData, shipType, planetId);
    if (failedShipRequirements.length > 0)
    {
        const requirements: string[] = Requirement.getRequirementDescriptions(failedShipRequirements, playerData, planetId);

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
                setRequestedQuantity(shipType, 0);
                return;
            }

            setRequestedQuantity(shipType, parsedValue);
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

function renderShipBuildRow(props: ShipyardViewProps, planetData: CoreType.PlanetData, serverData: CoreType.ServerData, shipType: number, requestedQuantity: number, setRequestedQuantity: (shipType: number, value: number) => void): ReactElement
{
    const shipName: string = ThingType.getSpecificThingName(ThingType.ship(shipType));
    const ownedQuantity: number = ShipData.getShipQuantity(planetData, shipType);
    const singleDurationSeconds: number = ShipConstructionData.getShipConstructionDurationSeconds(shipType, planetData, serverData) ?? 0;
    const costParts: string[] = buildSingleShipCostParts(shipType);

    const element: ReactElement =
    (
        <div key={shipType} className="flex flex-row items-center border border-gray-400 rounded">
            <div className="flex items-center justify-center px-4 py-3 border-r border-gray-400">
                {HelperElement.renderShipImage(shipType)}
            </div>

            <div className="flex flex-col px-4 py-3 border-r border-gray-400 min-w-[200px]">
                <div className="font-bold">{shipName}</div>
                <div className="text-xs">Time: {TimeFormat.formatRemainingTimeMs(singleDurationSeconds * 1000)}</div>
                <div className="text-xs">Cost: {costParts.join(" / ")}</div>
            </div>

            <div className="flex items-center justify-center px-4 py-3 border-r border-gray-400 min-w-[100px]">
                <div className="text-sm">{ownedQuantity} owned</div>
            </div>

            <div className="flex items-center justify-center px-4 py-3 min-w-[140px]">
                {renderQuantityInput(props, shipType, requestedQuantity, planetData, setRequestedQuantity)}
            </div>
        </div>
    );

    return element;
}

function renderShipBuildRows(props: ShipyardViewProps, shipTypes: number[], planetData: CoreType.PlanetData, serverData: CoreType.ServerData, requestedQuantities: Map<number, number>, setRequestedQuantity: (shipType: number, value: number) => void): ReactElement
{
    const rowElements: ReactElement[] = shipTypes.map((shipType: number) =>
    {
        const requestedQuantity: number = requestedQuantities.get(shipType) ?? 0;

        return renderShipBuildRow(props, planetData, serverData, shipType, requestedQuantity, setRequestedQuantity);
    });

    const element: ReactElement =
    (
        <div className="text-sm font-semibold text-white whitespace-nowrap inline-block">
            {rowElements}
        </div>
    );

    return element;
}

function renderActiveConstructionHeader(shipConstruction: CoreType.ShipConstruction): ReactElement | null
{
    const currentShipRow: DBType.ShipConstructionShipRow | undefined = shipConstruction.shipConstructionShipRows.find(
        (row: DBType.ShipConstructionShipRow): boolean => row.id === shipConstruction.shipConstructionRow.current_ship_construction_ship_row_id
    );

    if (currentShipRow === undefined)
    {
        return null;
    }

    const currentShipName: string = ThingType.getSpecificThingName(ThingType.ship(currentShipRow.ship_type));

    const element: ReactElement =
    (
        <div className="text-xs font-semibold text-yellow-400">Building: {currentShipName}</div>
    );

    return element;
}

function renderActiveConstructionSection(selectedPlanetDataPredicted: CoreType.PlanetData, serverData: CoreType.ServerData): ReactElement
{
    const shipConstructions: CoreType.ShipConstruction[] = selectedPlanetDataPredicted.dynamicPlanetData.shipConstructions;

    if (shipConstructions.length === 0)
    {
        const emptyElement: ReactElement =
        (
            <div className="border border-gray-400 rounded px-6 py-4 text-sm text-center w-full">
                No ship construction in progress.
            </div>
        );

        return emptyElement;
    }

    const sortedConstructions: CoreType.ShipConstruction[] = [...shipConstructions].sort(
        (a: CoreType.ShipConstruction, b: CoreType.ShipConstruction): number =>
        {
            const aIsStarted: boolean = a.shipConstructionRow.started_at !== null;
            const bIsStarted: boolean = b.shipConstructionRow.started_at !== null;

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

    const remainingMs: number = ShipConstructionData.getShipConstructionRemainingMs(selectedPlanetDataPredicted) ?? 0;

    const rowElements: ReactElement[] = sortedConstructions.map((shipConstruction: CoreType.ShipConstruction, index: number): ReactElement =>
    {
        const isActive: boolean = index === 0 && shipConstruction.shipConstructionRow.started_at !== null;
        return renderRow(selectedPlanetDataPredicted, shipConstruction, serverData, isActive, remainingMs);
    });

    const element: ReactElement =
    (
        <div className="flex flex-col gap-2 w-full">
            {rowElements}
        </div>
    );

    return element;
}

function renderRow(planetData: CoreType.PlanetData, shipConstruction: CoreType.ShipConstruction, serverData: CoreType.ServerData, isActive: boolean, remainingMs: number): ReactElement
{
    const headerElement: ReactElement | null = isActive === true ? renderActiveConstructionHeader(shipConstruction) : null;
    const timerElement: ReactElement = renderTimer(isActive, remainingMs, shipConstruction.shipConstructionRow.duration_at_request_time);

    const element: ReactElement =
    (
        <div key={shipConstruction.shipConstructionRow.id} className="flex flex-row border border-gray-400 rounded w-full h-24">
            <div className="flex flex-col gap-1 px-6 py-3 border-r border-gray-400 flex-1 min-w-[160px] overflow-y-auto">
                {headerElement}
                {renderShipLines(planetData, shipConstruction, serverData)}
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

function renderShipLines(planetData: CoreType.PlanetData, shipConstruction: CoreType.ShipConstruction, serverData: CoreType.ServerData): ReactElement[]
{
    ShipConstructionData.sortShipConstructionShipRowByConstructionTime(planetData, shipConstruction, serverData);
    const lineElements: ReactElement[] = [];

    for (const shipRow of shipConstruction.shipConstructionShipRows)
    {
        const shipName: string = ThingType.getSpecificThingName(ThingType.ship(shipRow.ship_type));

        lineElements.push(
            <div key={shipRow.ship_type} className="text-sm">
                {shipName} x {shipRow.ship_quantity}
            </div>
        );
    }

    return lineElements;
}

function renderBuildableShipLines(buildableQuantities: Map<number, number>): ReactElement
{
    const shipLineElements: ReactElement[] = [];

    for (const [shipType, shipQuantity] of buildableQuantities)
    {
        if (shipQuantity <= 0)
        {
            continue;
        }

        shipLineElements.push(
            <div key={shipType} className="text-sm">
                {ThingType.getSpecificThingName(ThingType.ship(shipType))} x {shipQuantity}
            </div>
        );
    }

    const element: ReactElement =
    (
        <div className="contents">
            {shipLineElements}
        </div>
    );

    return element;
}

function renderBuildableResourceLines(totalCost: Map<number, number>): ReactElement
{
    const resourceLineElements: ReactElement[] = [];

    for (const [resourceType, resourceCost] of totalCost)
    {
        resourceLineElements.push
        (
            <div key={resourceType} className="text-sm text-blue-400">
                {resourceCost} {ThingType.getSpecificThingName(ThingType.resource(resourceType))}
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

function renderBuildPreviewContent(planetData: CoreType.PlanetData, serverData: CoreType.ServerData, requestedMap: Map<number, number>): ReactElement | null
{
    if (requestedMap.size === 0)
    {
        return null;
    }

    const buildableQuantities: Map<number, number> = ShipConstructionData.computeMaxAffordableShipQuantities(planetData, requestedMap);

    if (buildableQuantities.size === 0)
    {
        return (
            <div className="border border-gray-400 rounded px-6 py-4 text-center w-80">
                Rien, esti de pauvre.
            </div>
        );
    }

    const totalDurationSeconds: number = ShipConstructionData.computeShipQuantitiesConstructionDurationSeconds(buildableQuantities, planetData, serverData);
    const totalCost: Map<number, number> = ShipConstructionData.computeShipConstructionCost(buildableQuantities);

    const element: ReactElement =
    (
        <div className="border border-gray-400 rounded px-6 py-4 flex flex-col items-center gap-2 w-80 bg-black">
            <div className="flex flex-col items-center gap-1">
                {renderBuildableShipLines(buildableQuantities)}
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

function renderBuildButton(planetData: CoreType.PlanetData, serverData: CoreType.ServerData, requestedMap: Map<number, number>, hasRequestedData: boolean, onBuildAll: () => void): ReactElement | null
{
    if (hasRequestedData === false)
    {
        return null;
    }
    
    const buildableQuantities: Map<number, number> = ShipConstructionData.computeMaxAffordableShipQuantities(planetData, requestedMap);

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
function createBuildShipsHandler(props: ShipyardViewProps, planetData: CoreType.PlanetData, requestedQuantities: Map<number, number>, resetRequestedQuantities: () => void): () => void
{
    return (): void =>
    {
        const runBuild = async (): Promise<void> =>
        {
            const errorMessage: string | null = await ClientRequestFunctions.clientTryBuildShipsRequest(props.clientDataStateResult.psController, planetData.planetRow.id, requestedQuantities);
            if (errorMessage !== null)
            {
                console.error("⚠️:", `Build ships failed for planetId ${planetData.planetRow.id}: ${errorMessage}`);
            }
        };
        runBuild();
        resetRequestedQuantities();
    };
}
//#endregion

function renderShipyardBody(props: ShipyardViewProps, planetDataPredicted: CoreType.PlanetData, quantitiesState: HelperElement.RequestedQuantitiesState): ReactElement
{
    const serverData: CoreType.ServerData = props.clientDataStateResult.sdsController[0];
    const shipTypes: number[] = ThingType.getAllSpecificThings(ThingType.Thing.Ship);

    const requestedMap: Map<number, number> = buildRequestedQuantitiesMap(shipTypes, quantitiesState.requestedQuantities);
    const hasRequestedData: boolean = requestedMap.size > 0;

    const onBuildAll: () => void = createBuildShipsHandler(props, planetDataPredicted, requestedMap, quantitiesState.resetRequestedQuantities);

    const previewContent: ReactElement | null = renderBuildPreviewContent(planetDataPredicted, serverData, requestedMap);
    const buildButton: ReactElement | null = renderBuildButton(planetDataPredicted, serverData, requestedMap, hasRequestedData, onBuildAll);
    const previewSlot: ReactElement = renderPreviewSlot(previewContent, buildButton);
    const buildRowElements: ReactElement = renderShipBuildRows(props, shipTypes, planetDataPredicted, serverData, quantitiesState.requestedQuantities, quantitiesState.setRequestedQuantity);
    const activeConstructionElements: ReactElement = renderActiveConstructionSection(planetDataPredicted, serverData);

    return renderShipyardLayout(previewSlot, buildRowElements, activeConstructionElements);
}

export function ShipyardView(props: ShipyardViewProps): ReactElement
{
    const quantitiesState: HelperElement.RequestedQuantitiesState = HelperElement.useRequestedQuantities();
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
        console.error("⚠️:", "ShipyardView render failed:", error);
        return <HelperElements.EmptyElement />;
    }
}
