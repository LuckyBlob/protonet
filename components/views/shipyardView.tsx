"use client";

import { useState, ChangeEvent, ReactElement } from "react";

import * as TimeFormat from "@/lib/helper/timeFormat";
import * as SelectedPlanet from "@/lib/localStorage/selectedPlanet";
import * as UseClientDataState from "@/lib/use/useClientDataState";
import * as PlayerUpdateClient from "@/lib/update/client/playerUpdateClient";
import * as AssociationMaps from "@/lib/gameplay/coreData/associationMaps";
import * as PlayerDataType from "@/lib/playerData/playerDataTypes";
import * as ShipData from "@/lib/playerData/shipData";
import * as ServerDataType from "@/lib/serverData/serverDataTypes";
import * as RequestType from "@/lib/serverRequests/requestTypes";
import * as HelperElements from "@/components/helperElements";

const PREVIEW_MAX_SHIP_LINES = 7;
const PREVIEW_MAX_RESOURCE_LINES = 7;
const PREVIEW_TEXT_LINE_HEIGHT_PX = 20;   
const PREVIEW_TOTAL_TIME_LINE_PX = 20;
const PREVIEW_COUNTDOWN_LINE_PX = 20;
const PREVIEW_BUTTON_PX = 40;             
const PREVIEW_BOX_VERTICAL_PADDING_PX = 32; 
const PREVIEW_STACK_GAPS_PX = 32;         

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

type RequestedQuantitiesState =
{
    requestedQuantities: Map<number, number>;
    setRequestedQuantity: (shipType: number, value: number) => void;
    resetRequestedQuantities: () => void;
};

//#region pure helpers

function getShipImagePath(shipType: number): string
{
    return `/ships/shipType_${shipType}/0.png`;
}

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
        costParts.push(`${resourceCost} ${AssociationMaps.getThingName(AssociationMaps.ThingType.Resource, resourceType)}`);
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

function buildShipQuantityRequests(shipTypes: number[], requestedQuantities: Map<number, number>): RequestType.ShipQuantityRequest[]
{
    const shipQuantityRequests: RequestType.ShipQuantityRequest[] = [];

    for (const shipType of shipTypes)
	{
        const requestedQuantity: number = requestedQuantities.get(shipType) ?? 0;
        if (requestedQuantity <= 0)
		{
			continue;
		}
		const newShipQuantityRequest: RequestType.ShipQuantityRequest =
		{
			shipType: shipType,
			shipQuantity: requestedQuantity,
		}

        shipQuantityRequests.push(newShipQuantityRequest);
    }
    return shipQuantityRequests;
}
//#endregion

//#region rendering helpers
function renderShipImage(shipType: number): ReactElement
{
    const imagePath = getShipImagePath(shipType);
	const element: ReactElement =
	(
		<div className="w-24 h-24 flex flex-col items-center justify-center text-center">
            <img
                src={imagePath}
                alt=""
                className="w-24 h-24 object-contain"
                onError={(e) => {
                    e.currentTarget.style.display = "none";
                    const fallback = e.currentTarget.nextElementSibling as HTMLElement | null;
                    if (fallback) fallback.style.display = "flex";
                }}
            />
            <div className="hidden flex-col items-center justify-center text-xs gap-1">
                <span>[Image]</span>
            </div>
        </div>
	);

	return element;
}

function renderConstructionCountdownLine(fullPlanetData: PlayerDataType.FullPlanetData): ReactElement | null
{
    const remainingMs: number | null = ShipData.getShipConstructionBatchRemainingMs(fullPlanetData);
    if (remainingMs === null)
	{
		return null;
	}
	const element: ReactElement =
	(
		<div className="text-sm font-semibold text-yellow-400 whitespace-nowrap inline-block">
            Next ship batch construction ends in: {TimeFormat.formatRemainingTimeMs(remainingMs)}
        </div>
	);
	return element;
}

function renderQuantityInput(shipType: number, requestedQuantity: number, setRequestedQuantity: (shipType: number, value: number) => void): ReactElement
{
    const handleQuantityChange = (e: ChangeEvent<HTMLInputElement>) =>
	{
        const parsedValue = Number.parseInt(e.target.value, 10);
        if (Number.isNaN(parsedValue) || parsedValue < 0) {
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

function renderShipBuildRow(fullPlanetData: PlayerDataType.FullPlanetData, serverData: ServerDataType.ServerData, shipType: number, requestedQuantity: number, setRequestedQuantity: (shipType: number, value: number) => void): ReactElement
{
    const shipName: string = AssociationMaps.getThingName(AssociationMaps.ThingType.Ship, shipType);
    const ownedQuantity: number = ShipData.getShipQuantity(fullPlanetData, shipType);
    const singleDurationSeconds: number = ShipData.getShipConstructionDurationSeconds(shipType, fullPlanetData, serverData)?? 0;
    const costParts: string[] = buildSingleShipCostParts(shipType);
	const element: ReactElement =
	(
		<div key={shipType} className="flex flex-row items-center border border-gray-400 rounded">
            <div className="flex items-center justify-center px-4 py-3 border-r border-gray-400">
                {renderShipImage(shipType)}
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
                {renderQuantityInput(shipType, requestedQuantity, setRequestedQuantity)}
            </div>
        </div>
	);
	return element;
}

function renderShipBuildRows(shipTypes: number[], fullPlanetData: PlayerDataType.FullPlanetData, serverData: ServerDataType.ServerData, requestedQuantities: Map<number, number>, setRequestedQuantity: (shipType: number, value: number) => void): ReactElement
{
    const rowElements = shipTypes.map((shipType: number) =>
	{
        const requestedQuantity = requestedQuantities.get(shipType) ?? 0;
        return renderShipBuildRow(fullPlanetData, serverData, shipType, requestedQuantity, setRequestedQuantity);
    });
	const element: ReactElement =
	(
        <div className="text-sm font-semibold text-white whitespace-nowrap inline-block">
            {rowElements}
        </div>
	);
	return element;
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
                {AssociationMaps.getThingName(AssociationMaps.ThingType.Ship, shipType)} x {shipQuantity}
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
                {resourceCost} {AssociationMaps.getThingName(AssociationMaps.ThingType.Resource, resourceType)}
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

function renderBuildButton(hasRequestedData: boolean, onBuildAll: () => void): ReactElement | null
{
    if (!hasRequestedData)
	{
		return null;
	}

	const element: ReactElement =
	(
        <button
            onClick={onBuildAll}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
            Build all
        </button>
    );
    return element;
}

function renderShipyardLayout(previewSlot: ReactElement, buildRowElements: ReactElement, countdownLine: ReactElement | null): ReactElement
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

            <div className="relative flex flex-col gap-2 items-center">
                {countdownLine && (
                    <div 
                        className="absolute text-sm font-semibold text-yellow-400 whitespace-nowrap z-20"
                        style={{ 
                            transform: 'translateY(-100%)', 
                            top: '-12px' 
                        }}
                    >
                        {countdownLine}
                    </div>
                )}
                {buildRowElements}
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
function useRequestedQuantities(): RequestedQuantitiesState
{
    const [requestedQuantities, setRequestedQuantitiesMap] = useState<Map<number, number>>(new Map<number, number>());

    const setRequestedQuantity = (shipType: number, value: number) =>
	{
        const updatedMap = new Map<number, number>(requestedQuantities);
        updatedMap.set(shipType, value);
        setRequestedQuantitiesMap(updatedMap);
    };

    const resetRequestedQuantities = () =>
	{
        setRequestedQuantitiesMap(new Map<number, number>());
    };

    return {
        requestedQuantities,
        setRequestedQuantity,
        resetRequestedQuantities,
    };
}

function makeBuildAllHandler(props: ShipyardViewProps, fullPlanetData: PlayerDataType.FullPlanetData, shipTypes: number[], requestedQuantities: Map<number, number>, resetRequestedQuantities: () => void): () => void 
{
    return () =>
	{
        const shipQuantityRequests: RequestType.ShipQuantityRequest[] = buildShipQuantityRequests(shipTypes, requestedQuantities);
        if (shipQuantityRequests.length === 0)
		{
			return;
		}

        PlayerUpdateClient.tryBuildShipsClient(props.clientDataStateResult.psController, fullPlanetData.planetRow.id, shipQuantityRequests);
        resetRequestedQuantities();
    };
}

//#endregion

function renderShipyardBody(props: ShipyardViewProps, fullPlanetData: PlayerDataType.FullPlanetData, quantitiesState: RequestedQuantitiesState): ReactElement
{
	const serverData: ServerDataType.ServerData = props.clientDataStateResult.sdsController[0];
    const shipTypes: number[] = AssociationMaps.getTypes(AssociationMaps.ThingType.Ship);

    const requestedMap: Map<number, number> = buildRequestedQuantitiesMap(shipTypes, quantitiesState.requestedQuantities);
    const hasRequestedData: boolean = requestedMap.size > 0;

    const onBuildAll: () => void = makeBuildAllHandler(props, fullPlanetData, shipTypes, quantitiesState.requestedQuantities, quantitiesState.resetRequestedQuantities);

    const countdownLine: ReactElement | null = renderConstructionCountdownLine(fullPlanetData);
    const previewContent: ReactElement | null = renderBuildPreviewContent(fullPlanetData, serverData, requestedMap);
    const buildButton: ReactElement | null = renderBuildButton(hasRequestedData, onBuildAll);
    const previewSlot: ReactElement = renderPreviewSlot(previewContent, buildButton);
    const buildRowElements: ReactElement = renderShipBuildRows(shipTypes, fullPlanetData, serverData, quantitiesState.requestedQuantities, quantitiesState.setRequestedQuantity);

    return renderShipyardLayout(previewSlot, buildRowElements, countdownLine);
}

export function ShipyardView(props: ShipyardViewProps): ReactElement
{
    const quantitiesState: RequestedQuantitiesState = useRequestedQuantities();
    const selectedFullPlanetDataPredicted: PlayerDataType.FullPlanetData = SelectedPlanet.getSelectedFullPlanetDataPredicted(props.clientDataStateResult.psController[0]);

    if (!selectedFullPlanetDataPredicted)
	{
        return <HelperElements.EmptyElement />;
    }

    try
	{
        return renderShipyardBody(props, selectedFullPlanetDataPredicted, quantitiesState);
    }
	catch (error)
	{
        console.warn("⚠️:", error);
        return <HelperElements.EmptyElement />;
    }
}