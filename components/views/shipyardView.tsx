"use client";

import { useState, useEffect, ChangeEvent, ReactElement } from "react";

import * as TimeFormat from "@/lib/helper/timeFormat";
import * as SelectedPlanet from "@/lib/localStorage/selectedPlanet";
import * as UseClientDataState from "@/lib/use/useClientDataState";
import * as ClientRequestFunctions from "@/lib/networkRequests/client/clientRequestFunctions";
import * as PlayerDataType from "@/lib/gameplay/gameplayData/player/playerDataTypes";
import * as ShipData from "@/lib/gameplay/gameplayData/dynamic/shipData";
import * as ServerDataType from "@/lib/gameplay/gameplayData/server/serverDataTypes";
import * as HelperElements from "@/components/helperElements";
import * as ThingType from "@/lib/gameplay/coreData/type/thingTypes";
import * as Requirement from "@/lib/gameplay/coreData/requirement/requirements";
import * as RequirementType from "@/lib/gameplay/coreData/requirement/requirementTypes";
import * as HelperElement from "@/components/helperElements";

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
    const singleCostMap: Map<number, number> | null = ShipData.getSingleShipCost(shipType);

    if (singleCostMap === null)
    {
        return [];
    }

    const costParts: string[] = [];

    for (const [resourceType, resourceCost] of singleCostMap)
    {
        costParts.push(`${resourceCost} ${ThingType.getSpecificThingName(ThingType.resource(resourceType))}`);
    }

    return costParts;
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
function renderQuantityInput(props: ShipyardViewProps, shipType: number, requestedQuantity: number, fullPlanetData: PlayerDataType.FullPlanetData, setRequestedQuantity: (shipType: number, value: number) => void): ReactElement
{
    const playerData: PlayerDataType.PlayerData = props.clientDataStateResult.psController[0].predictedDBData;
    const planetId: number = fullPlanetData.planetRow.id;

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

function renderShipBuildRow(props: ShipyardViewProps, fullPlanetData: PlayerDataType.FullPlanetData, serverData: ServerDataType.ServerData, shipType: number, requestedQuantity: number, setRequestedQuantity: (shipType: number, value: number) => void): ReactElement
{
    const shipName: string = ThingType.getSpecificThingName(ThingType.ship(shipType));
    const ownedQuantity: number = ShipData.getShipQuantity(fullPlanetData, shipType);
    const singleDurationSeconds: number = ShipData.getShipConstructionDurationSeconds(shipType, fullPlanetData, serverData) ?? 0;
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
                {renderQuantityInput(props, shipType, requestedQuantity, fullPlanetData, setRequestedQuantity)}
            </div>
        </div>
    );

    return element;
}

function renderShipBuildRows(props: ShipyardViewProps, shipTypes: number[], fullPlanetData: PlayerDataType.FullPlanetData, serverData: ServerDataType.ServerData, requestedQuantities: Map<number, number>, setRequestedQuantity: (shipType: number, value: number) => void): ReactElement
{
    const rowElements: ReactElement[] = shipTypes.map((shipType: number) =>
    {
        const requestedQuantity: number = requestedQuantities.get(shipType) ?? 0;

        return renderShipBuildRow(props, fullPlanetData, serverData, shipType, requestedQuantity, setRequestedQuantity);
    });

    const element: ReactElement =
    (
        <div className="text-sm font-semibold text-white whitespace-nowrap inline-block">
            {rowElements}
        </div>
    );

    return element;
}

function renderActiveConstructionSection(selectedFullPlanetDataPredicted: PlayerDataType.FullPlanetData): ReactElement
{
    const queuedBatchs: PlayerDataType.ShipConstructionBatch[] = selectedFullPlanetDataPredicted.dynamicPlanetData.queuedShipConstructionBatchs;

    if (queuedBatchs.length === 0)
    {
        const emptyElement: ReactElement =
        (
            <div className="border border-gray-400 rounded px-6 py-4 text-sm text-center w-full">
                No ship construction in progress.
            </div>
        );

        return emptyElement;
    }

    const remainingMs: number = ShipData.getShipConstructionBatchRemainingMs(selectedFullPlanetDataPredicted) ?? 0;

    const rowElements: ReactElement[] = queuedBatchs.map((batch: PlayerDataType.ShipConstructionBatch, batchIndex: number): ReactElement =>
    {
        return renderBatchRow(batch, batchIndex, remainingMs);
    });

    const element: ReactElement =
    (
        <div className="flex flex-col gap-2 w-full">
            {rowElements}
        </div>
    );

    return element;
}

function renderBatchRow(batch: PlayerDataType.ShipConstructionBatch, batchIndex: number, remainingMs: number): ReactElement
{
    const isActiveBatch: boolean = (batchIndex === 0);
    const timerElement: ReactElement = renderBatchTimer(isActiveBatch, remainingMs);

    const element: ReactElement =
    (
        <div key={batch.batchId} className="flex flex-row border border-gray-400 rounded w-full h-24">
            <div className="flex flex-col gap-1 px-6 py-3 border-r border-gray-400 flex-1 min-w-[160px] overflow-y-auto">
                {renderBatchShipLines(batch)}
            </div>
            <div className="flex items-center justify-center px-6 py-3 w-[140px] shrink-0">
                {timerElement}
            </div>
        </div>
    );

    return element;
}

function renderBatchTimer(isActiveBatch: boolean, remainingMs: number): ReactElement
{
    if (isActiveBatch === true)
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
        <div className="text-sm text-gray-400">
            nothing
        </div>
    );

    return idleElement;
}

function renderBatchShipLines(batch: PlayerDataType.ShipConstructionBatch): ReactElement[]
{
    const lineElements: ReactElement[] = [];

    for (const shipConstructionRow of batch.shipConstructionRows)
    {
        const shipName: string = ThingType.getSpecificThingName(ThingType.ship(shipConstructionRow.ship_type));

        lineElements.push(
            <div key={shipConstructionRow.ship_type} className="text-sm">
                {shipName} / {shipConstructionRow.ship_quantity}
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

function renderBuildPreviewContent(fullPlanetData: PlayerDataType.FullPlanetData, serverData: ServerDataType.ServerData, requestedMap: Map<number, number>): ReactElement | null
{
    if (requestedMap.size === 0)
    {
        return null;
    }

    const buildableQuantities: Map<number, number> = ShipData.computeMaxAffordableShipQuantities(fullPlanetData, requestedMap);

    if (buildableQuantities.size === 0)
    {
        return (
            <div className="border border-gray-400 rounded px-6 py-4 text-center w-80">
                Rien, esti de pauvre.
            </div>
        );
    }

    const totalDurationSeconds: number = ShipData.computeShipQuantitiesConstructionDurationSeconds(buildableQuantities, fullPlanetData, serverData);
    const totalCost: Map<number, number> = ShipData.computeShipConstructionBatchCost(buildableQuantities);

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

function renderBuildButton(fullPlanetData: PlayerDataType.FullPlanetData, serverData: ServerDataType.ServerData, requestedMap: Map<number, number>, hasRequestedData: boolean, onBuildAll: () => void): ReactElement | null
{
    if (hasRequestedData === false)
    {
        return null;
    }
    
    const buildableQuantities: Map<number, number> = ShipData.computeMaxAffordableShipQuantities(fullPlanetData, requestedMap);

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
function createBuildShipsHandler(props: ShipyardViewProps, fullPlanetData: PlayerDataType.FullPlanetData, requestedQuantities: Map<number, number>, resetRequestedQuantities: () => void): () => void
{
    return () =>
    {
        ClientRequestFunctions.clientTryBuildShipsRequest(props.clientDataStateResult.psController, fullPlanetData.planetRow.id, requestedQuantities);
        resetRequestedQuantities();
    };
}
//#endregion

function renderShipyardBody(props: ShipyardViewProps, fullPlanetDataPredicted: PlayerDataType.FullPlanetData, quantitiesState: HelperElement.RequestedQuantitiesState): ReactElement
{
    const serverData: ServerDataType.ServerData = props.clientDataStateResult.sdsController[0];
    const shipTypes: number[] = ThingType.getAllSpecificThings(ThingType.Thing.Ship);

    const requestedMap: Map<number, number> = buildRequestedQuantitiesMap(shipTypes, quantitiesState.requestedQuantities);
    const hasRequestedData: boolean = requestedMap.size > 0;

    const onBuildAll: () => void = createBuildShipsHandler(props, fullPlanetDataPredicted, requestedMap, quantitiesState.resetRequestedQuantities);

    const previewContent: ReactElement | null = renderBuildPreviewContent(fullPlanetDataPredicted, serverData, requestedMap);
    const buildButton: ReactElement | null = renderBuildButton(fullPlanetDataPredicted, serverData, requestedMap, hasRequestedData, onBuildAll);
    const previewSlot: ReactElement = renderPreviewSlot(previewContent, buildButton);
    const buildRowElements: ReactElement = renderShipBuildRows(props, shipTypes, fullPlanetDataPredicted, serverData, quantitiesState.requestedQuantities, quantitiesState.setRequestedQuantity);
    const activeConstructionElements: ReactElement = renderActiveConstructionSection(fullPlanetDataPredicted);

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
        const selectedFullPlanetDataPredicted: PlayerDataType.FullPlanetData = SelectedPlanet.getSelectedFullPlanetDataPredicted(props.clientDataStateResult.psController[0]);
        return renderShipyardBody(props, selectedFullPlanetDataPredicted, quantitiesState);
    }
    catch (error: unknown)
    {
        console.error("⚠️:", error);
        return <HelperElements.EmptyElement />;
    }
}
