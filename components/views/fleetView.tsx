"use client";

import { ReactElement, ChangeEvent, useState } from "react";

import * as SelectedPlanet from "@/lib/localStorage/selectedPlanet";
import * as UseClientDataState from "@/lib/use/useClientDataState";
import * as ThingType from "@/lib/gameplay/coreData/type/thingTypes";
import * as PlayerDataType from "@/lib/gameplay/gameplayData/player/playerDataTypes";
import * as HelperElements from "@/components/helperElements";
import * as FleetData from "@/lib/gameplay/gameplayData/dynamic/fleetData";
import * as ShipData from "@/lib/gameplay/gameplayData/dynamic/shipData";
import * as HelperElement from "@/components/helperElements";
import * as GameType from "@/lib/gameplay/coreData/type/gameTypes"
import * as ResourceData from "@/lib/gameplay/gameplayData/dynamic/resourceData";
import * as MathHelp from "@/lib/helper/mathHelp";
import * as ClientRequestFunctions from "@/lib/networkRequests/client/clientRequestFunctions";
import * as DBType from "@/lib/db/dbTypes";

type FleetViewProps =
{
    clientDataStateResult: UseClientDataState.ClientDataStateResult;
};

type FleetViewData = 
{
    fullPlanetData: PlayerDataType.FullPlanetData;
    galaxyIdState: [number, (value: number) => void, (e: ChangeEvent<HTMLInputElement>) => void];
    systemIdState: [number, (value: number) => void, (e: ChangeEvent<HTMLInputElement>) => void];
    slotIdState: [number, (value: number) => void, (e: ChangeEvent<HTMLInputElement>) => void];
    requestedShipQuantitiesState: HelperElement.RequestedQuantitiesState;
    requestedResourceQuantitiesState: HelperElement.RequestedQuantitiesState;
    fleetActionState: [number, (value: number) => void];
    sendErrorState: [string | null, (value: string | null) => void];
}

//#region rendering helpers
function renderFleetMovementsSection(): ReactElement
{
    const element: ReactElement =
    (
        <div className="border border-gray-400 rounded px-6 py-3 text-sm text-center text-gray-400 w-full h-24 flex items-center justify-center">
            No fleet movements.
        </div>
    );

    return element;
}

function renderFleetShipRows(props: FleetViewProps, data: FleetViewData): ReactElement
{
    const shipTypes: number[] = ThingType.getAllSpecificThings(ThingType.Thing.Ship);
    
    const rowElements: (ReactElement | null)[] = shipTypes.map((shipType: number) =>
    {
        const requestedQuantity: number = data.requestedShipQuantitiesState.requestedQuantities.get(shipType) ?? 0;

        return renderFleetShipRow(props, shipType, requestedQuantity, data.requestedShipQuantitiesState.setRequestedQuantity);
    });

    const element: ReactElement =
    (
        <div className="text-sm font-semibold text-white whitespace-nowrap inline-block">
            {rowElements}
        </div>
    );

    return element;
}

function renderFleetShipRow(props: FleetViewProps, shipType: number, requestedQuantity: number, setRequestedQuantity: (shipType: number, value: number) => void): ReactElement | null
{
    const selectedFullPlanetDataPredicted: PlayerDataType.FullPlanetData = SelectedPlanet.getSelectedFullPlanetDataPredicted(props.clientDataStateResult.psController[0]);

    const shipName: string = ThingType.getSpecificThingName(ThingType.ship(shipType));
    const ownedQuantity: number = ShipData.getShipQuantity(selectedFullPlanetDataPredicted, shipType);
    if (ownedQuantity === 0)
    {
        return null;
    }

    const element: ReactElement =
    (
        <div key={shipType} className="flex flex-row items-center border border-gray-400 rounded h-31 w-full">
            
            <div className="flex flex-col items-center justify-center px-4 py-2 border-r border-gray-400 gap-1 w-[160px] h-full">
                {HelperElement.renderShipImage(shipType)}
                <div className="font-bold text-sm text-center whitespace-nowrap">{shipName}</div>
            </div>

            <div className="flex flex-col items-center justify-center h-full px-4 gap-1 flex-1">
                {HelperElement.renderQuantityInput(shipType, 0, ownedQuantity, requestedQuantity, selectedFullPlanetDataPredicted, setRequestedQuantity)}
                <div className="text-sm font-semibold whitespace-nowrap">{ownedQuantity} owned</div>
            </div>
        </div>
    );

    return element;
}

function renderFleetActionInput(props: FleetViewProps, data: FleetViewData): ReactElement
{
    const element: ReactElement =
    (
        <div className="text-sm font-semibold text-white whitespace-nowrap flex flex-col items-center gap-4">
            {renderPlanetTargetInput(props, data)}
            {renderFleetMaxResource(props, data)}
            {renderFleetResourceRows(props, data)}
            {renderFleetActionChoice(props, data)}
        </div>
    );

    return element;
}

function getIdState(max: number): [number, (value: number) => void, (e: ChangeEvent<HTMLInputElement>) => void]
{
    const idState: [number, (value: number) => void] = useState<number>(1);
    const handleQuantityChange = (e: ChangeEvent<HTMLInputElement>): void =>
    {
        const parsedValue: number = Number.parseInt(e.target.value, 10);

        if (Number.isNaN(parsedValue) || parsedValue < 0)
        {
            idState[1](1);
            return;
        }

        idState[1](Math.min(Math.max(parsedValue, 1), max));
    };

    return [idState[0], idState[1], handleQuantityChange];
}

function renderPlanetTargetInput(props: FleetViewProps, data: FleetViewData): ReactElement
{
    const galaxyIdElement: ReactElement =
    (
        <div>
            <div className="text-sm font-normal text-white">
                Target planet (slot/system/galaxy)
            </div>
            <div className="flex flex-row items-center gap-2">
                <input
                    type="number"
                    min={1}
                    max={GameType.SLOT_COUNT}
                    value={data.slotIdState[0]}
                    onChange={data.slotIdState[2]}
                    className="border border-gray-400 px-2 py-1 rounded bg-white text-black w-14 text-center"
                    placeholder="P"
                />
                <span className="text-gray-400 font-bold">:</span>
                <input
                    type="number"
                    min={1}
                    max={GameType.SYSTEM_COUNT}
                    value={data.systemIdState[0]}
                    onChange={data.systemIdState[2]}
                    className="border border-gray-400 px-2 py-1 rounded bg-white text-black w-14 text-center"
                    placeholder="S"
                />
                <span className="text-gray-400 font-bold">:</span>
                <input
                    type="number"
                    min={1}
                    max={GameType.GALAXY_COUNT}
                    value={data.galaxyIdState[0]}
                    onChange={data.galaxyIdState[2]}
                    className="border border-gray-400 px-2 py-1 rounded bg-white text-black w-14 text-center"
                    placeholder="G"
                />
            </div>
        </div>
    );

    return galaxyIdElement;
}

function renderFleetMaxResource(props: FleetViewProps, data: FleetViewData): ReactElement
{
    const originAddress: GameType.PlanetAddress = 
    {
        galaxy: data.fullPlanetData.planetRow.galaxy,
        system: data.fullPlanetData.planetRow.system,
        slot: data.fullPlanetData.planetRow.slot,
    }
    const targetAddress: GameType.PlanetAddress = 
    {
        galaxy: data.galaxyIdState[0],
        system: data.systemIdState[0],
        slot: data.slotIdState[0],
    }
    const fuelRequirements: Map<number, number> = FleetData.calculateTotalFleetFuel(originAddress, targetAddress, data.requestedShipQuantitiesState.requestedQuantities, props.clientDataStateResult.sdsController[0]);
    const totalFuel: number = MathHelp.calculateTotalQuantityMap(fuelRequirements);
    const totalSpace: number = FleetData.calculateTotalFleetSpace(data.requestedShipQuantitiesState.requestedQuantities);
    const availableSpace: number = Math.max(totalSpace - totalFuel, 0);

    const element: ReactElement =
    (
        <div className="text-sm font-normal text-white whitespace-nowrap inline-block">
            Fuel cost: {totalFuel}, available space: {availableSpace}
        </div>
    );

    return element;
}

function renderFleetResourceRows(props: FleetViewProps, data: FleetViewData): ReactElement
{
    const resourceTypes: number[] = ThingType.getAllSpecificThings(ThingType.Thing.Ship);
    
    const rowElements: (ReactElement | null)[] = resourceTypes.map((resourceType: number) =>
    {
        return renderFleetResourceRow(props, resourceType, data);
    });

    const element: ReactElement =
    (
        <div className="text-white whitespace-nowrap inline-block">
            {rowElements}
        </div>
    );

    return element;
}

function renderFleetResourceRow(props: FleetViewProps, resourceType: number, data: FleetViewData): ReactElement | null
{
    const requestedResourceQuantity: number = data.requestedResourceQuantitiesState.requestedQuantities.get(resourceType) ?? 0;

    const resourceName: string = ThingType.getSpecificThingName(ThingType.resource(resourceType));
    const ownedResourceQuantity: number = Math.floor(ResourceData.getResourceQuantity(data.fullPlanetData, resourceType));
    const originAddress: GameType.PlanetAddress = 
    {
        galaxy: data.fullPlanetData.planetRow.galaxy,
        system: data.fullPlanetData.planetRow.system,
        slot: data.fullPlanetData.planetRow.slot,
    }
    const targetAddress: GameType.PlanetAddress = 
    {
        galaxy: data.galaxyIdState[0],
        system: data.systemIdState[0],
        slot: data.slotIdState[0],
    }
    const fuelRequirements: Map<number, number> = FleetData.calculateTotalFleetFuel(originAddress, targetAddress, data.requestedShipQuantitiesState.requestedQuantities, props.clientDataStateResult.sdsController[0]);
    const totalSpace: number = FleetData.calculateTotalFleetSpace(data.requestedShipQuantitiesState.requestedQuantities);
    const totalFuel: number = MathHelp.calculateTotalQuantityMap(fuelRequirements);

    let otherResourcesRequested: number = 0;
    for (const [otherType, otherQty] of data.requestedResourceQuantitiesState.requestedQuantities)
    {
        if (otherType !== resourceType)
        {
            otherResourcesRequested += otherQty;
        }
    }

    const availableSpaceForThisResource: number = Math.max(totalSpace - totalFuel - otherResourcesRequested, 0);
    const maxResourcePossible: number = Math.min(ownedResourceQuantity, availableSpaceForThisResource);

    const element: ReactElement =
    (
        <div key={resourceType} className="flex flex-row items-center justify-start gap-2 h-10 w-full text-sm">
            <span className="font-semibold text-white w-16 text-left">
                {resourceName}
            </span>
            <div>
                {HelperElement.renderQuantityInput(resourceType, 0, maxResourcePossible, requestedResourceQuantity, data.fullPlanetData, data.requestedResourceQuantitiesState.setRequestedQuantity)}
            </div>
            <span className="text-gray-400 font-normal">
                (max: {ownedResourceQuantity})
            </span>
        </div>
    );

    return element;
}

function renderFleetActionChoice(props: FleetViewProps, data: FleetViewData): ReactElement
{
    const selectedAction: number = data.fleetActionState[0];
    const setSelectedAction: (value: number) => void = data.fleetActionState[1];

    const totalShipsRequested: number = MathHelp.calculateTotalQuantityMap(data.requestedShipQuantitiesState.requestedQuantities);

    const targetPlanetAddress: GameType.PlanetAddress =
    {
        galaxy: data.galaxyIdState[0],
        system: data.systemIdState[0],
        slot: data.slotIdState[0],
    }

    const targetPublicRow: DBType.PublicPlanetRow | undefined = props.clientDataStateResult.psController[0].dbData.publicPlanetRows.find((row: DBType.PublicPlanetRow): boolean =>
    {
        return (
            (row.galaxy === targetPlanetAddress.galaxy) &&
            (row.system === targetPlanetAddress.system) &&
            (row.slot === targetPlanetAddress.slot)
        );
    });

    const targetOwnerPlayerId: number | null = targetPublicRow?.owner_player_id ?? null;

    const validActionIds: number[] = Array.from(GameType.FLEET_ACTION_NAMES.keys()).filter((actionId: number): boolean =>
    {
        return FleetData.canExecuteFleetActionOnTargetAddress(data.fullPlanetData, targetOwnerPlayerId, data.requestedShipQuantitiesState.requestedQuantities, actionId);
    });

    const isSelectedActionValid: boolean = validActionIds.includes(selectedAction);
    const isSamePlanet: boolean =
        (data.fullPlanetData.planetRow.galaxy === data.galaxyIdState[0]) &&
        (data.fullPlanetData.planetRow.system === data.systemIdState[0]) &&
        (data.fullPlanetData.planetRow.slot === data.slotIdState[0]);
    const isSendDisabled: boolean = (totalShipsRequested === 0) || (isSelectedActionValid === false) || (isSamePlanet === true);

    const handleChange = (e: ChangeEvent<HTMLSelectElement>): void =>
    {
        const parsedValue: number = Number.parseInt(e.target.value, 10);
        setSelectedAction(parsedValue);
    };

    const setSendError: (value: string | null) => void = data.sendErrorState[1];
    const handleSendFleet = async (): Promise<void> =>
    {
        const errorMessage: string | null = await ClientRequestFunctions.clientTrySendFleetRequest(
            props.clientDataStateResult.psController,
            data.fullPlanetData.planetRow.id,
            targetPlanetAddress,
            selectedAction,
            data.requestedShipQuantitiesState.requestedQuantities,
            data.requestedResourceQuantitiesState.requestedQuantities);

        setSendError(errorMessage);
    };

    const sendError: string | null = data.sendErrorState[0];
    const errorElement: ReactElement | null = (sendError !== null)
        ? <div className="text-sm font-normal text-red-400 whitespace-nowrap">{sendError}</div>
        : null;

    const optionElements: ReactElement[] = validActionIds.map((actionId: number): ReactElement =>
    {
        const actionName: string = GameType.FLEET_ACTION_NAMES.get(actionId) ?? "";

        const optionElement: ReactElement =
        (
            <option key={actionId} value={actionId}>
                {actionName}
            </option>
        );

        return optionElement;
    });

    const placeholderOption: ReactElement | null = (isSelectedActionValid === false)
        ? <option key="none" value="" disabled>-- Select an action --</option>
        : null;

    const element: ReactElement =
    (
        <div className="flex flex-col items-center gap-2">
            <div className="text-sm font-normal text-white">
                Fleet action
            </div>
            <div className="flex flex-row items-center gap-2">
                <select
                    value={isSelectedActionValid ? selectedAction : ""}
                    onChange={handleChange}
                    className="border border-gray-400 px-2 py-1 rounded bg-white text-black"
                >
                    {placeholderOption}
                    {optionElements}
                </select>

                <button
                    type="button"
                    onClick={handleSendFleet}
                    disabled={isSendDisabled}
                    className="border border-gray-400 px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold"
                >
                    Send fleet
                </button>
            </div>
            {errorElement}
        </div>
    );

    return element;
}

function renderFleetViewLayout(props: FleetViewProps, data: FleetViewData): ReactElement
{
    const element: ReactElement =
    (
        <div className="w-full flex flex-col items-center pt-4">
            <div className="flex flex-row items-center justify-center">
                <div className="flex flex-col items-center gap-2 px-6">
                    {renderFleetShipRows(props, data)}
                </div>

                <div className="w-px bg-gray-400 h-24 my-0" />

                <div className="flex flex-col items-center gap-2 px-6">
                    {renderFleetActionInput(props, data)}
                </div>

                <div className="w-px bg-gray-400 h-24 my-0" />

                <div className="flex flex-col items-center gap-2 px-6">
                    {renderFleetMovementsSection()}
                </div>
            </div>
        </div>
    );
    return element;
}
//#endregion

export function FleetView(props: FleetViewProps): ReactElement
{
    try
    {
        const fleetViewData: FleetViewData = 
        {
            fullPlanetData: SelectedPlanet.getSelectedFullPlanetDataPredicted(props.clientDataStateResult.psController[0]),
            galaxyIdState: getIdState(GameType.GALAXY_COUNT),
            systemIdState: getIdState(GameType.SYSTEM_COUNT),
            slotIdState: getIdState(GameType.SLOT_COUNT),
            requestedShipQuantitiesState: HelperElement.useRequestedQuantities(),
            requestedResourceQuantitiesState: HelperElement.useRequestedQuantities(),
            fleetActionState: useState<number>(GameType.FLEET_ACTION_STATION),
            sendErrorState: useState<string | null>(null),
        }
        return renderFleetViewLayout(props, fleetViewData);
    }
    catch (error: unknown)
    {
        console.error("⚠️:", error);
        return <HelperElements.EmptyElement />;
    }
}
