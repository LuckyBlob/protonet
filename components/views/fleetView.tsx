"use client";

import { ReactElement, ChangeEvent, useState, useEffect } from "react";

import * as TimeFormat from "@/lib/helper/timeFormat";
import * as SelectedPlanet from "@/lib/localStorage/selectedPlanet";
import * as UseClientDataState from "@/lib/use/useClientDataState";
import * as ThingType from "@/lib/gameplay/coreData/type/thingTypes";
import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as HelperElements from "@/components/helperElements";
import * as FleetData from "@/lib/gameplay/dynamicData/planet/fleet/fleetData";
import * as ShipData from "@/lib/gameplay/dynamicData/planet/shipData";
import * as HelperElement from "@/components/helperElements";
import * as GameType from "@/lib/gameplay/coreData/type/gameTypes"
import * as ResourceData from "@/lib/gameplay/dynamicData/planet/resourceData";
import * as MathHelp from "@/lib/helper/mathHelp";
import * as ClientRequestFunctions from "@/lib/networkRequests/client/clientRequestFunctions";
import * as DBType from "@/lib/db/dbTypes";
import * as FleetMovementDuration from "@/lib/gameplay/coreData/formula/fleedMovementDurationFormulas";

type FleetViewProps =
{
    clientDataStateResult: UseClientDataState.ClientDataStateResult;
};

type FleetViewData = 
{
    planetData: CoreType.PlanetData;
    playerData: CoreType.PlayerData;
    galaxyIdState: [number, (value: number) => void, (e: ChangeEvent<HTMLInputElement>) => void];
    systemIdState: [number, (value: number) => void, (e: ChangeEvent<HTMLInputElement>) => void];
    slotIdState: [number, (value: number) => void, (e: ChangeEvent<HTMLInputElement>) => void];
    requestedShipQuantitiesState: HelperElement.RequestedQuantitiesState;
    requestedResourceQuantitiesState: HelperElement.RequestedQuantitiesState;
    fleetActionState: [number, (value: number) => void];
    sendErrorState: [string | null, (value: string | null) => void];
}

//#region rendering helpers
function renderFleetMovementRow(fleetMovement: CoreType.FleetMovement, publicPlanetRows: DBType.PublicPlanetRow[]): ReactElement
{
    const fleetMovementRow: DBType.FleetMovementRow = fleetMovement.fleetMovementRow;
    const originAddress: string = GameType.formatPlanetAddress(fleetMovementRow.planet_origin_galaxy, fleetMovementRow.planet_origin_system, fleetMovementRow.planet_origin_slot);
    const targetAddress: string = GameType.formatPlanetAddress(fleetMovementRow.planet_target_galaxy, fleetMovementRow.planet_target_system, fleetMovementRow.planet_target_slot);
    const actionName: string = GameType.FLEET_ACTION_NAMES.get(fleetMovementRow.fleet_action_type) ?? `Unknown (${fleetMovementRow.fleet_action_type})`;
    const isReturnTrip: boolean = fleetMovementRow.is_return_trip === 1;
    const remainingMs: number | null = FleetData.getFleetMovementRemainingMs(fleetMovement);

    if (remainingMs === null)
    {
        throw new Error(`Fleet movement ${fleetMovementRow.id} has no started_at or duration_at_start_time.`);
    }

    const isUnknownResult: boolean = remainingMs < 0 && fleetMovement.resolutionState === CoreType.FleetMovementResolution.ResolveResultUnknown;

    const element: ReactElement =
    (
        <div key={fleetMovementRow.id} className="border border-gray-400 rounded px-4 py-2 text-sm text-white w-full">
            <div>{originAddress} → {targetAddress}</div>
            {isUnknownResult ?
            (
                <div className="text-sm font-semibold text-yellow-400">Unknown result.</div>
            ) : (
            <>
                <div>{actionName}{isReturnTrip ? " (return)" : ""}</div>
                <div className="text-gray-400">
                    {TimeFormat.formatRemainingTimeMs(remainingMs)}
                </div>
            </>
            )}
        </div>
    );

    return element;
}

function renderFleetMovementsSection(props: FleetViewProps): ReactElement
{
    const planetDataPredicted: CoreType.PlanetData = SelectedPlanet.getSelectedPlanetDataPredicted(props.clientDataStateResult.psController[0]);
    const playerData: CoreType.PlayerData = props.clientDataStateResult.psController[0].predictedDBData;
    
    const publicPlanetRows: DBType.PublicPlanetRow[] = playerData.publicPlanetRows;

    const seenFleetIds: Set<number> = new Set<number>();
    const allFleetMovements: CoreType.FleetMovement[] = [];

    for (const fleetMovement of planetDataPredicted.dynamicPlanetData.futureFleetArrivals)
    {
        if (seenFleetIds.has(fleetMovement.fleetMovementRow.id) === false)
        {
            seenFleetIds.add(fleetMovement.fleetMovementRow.id);
            allFleetMovements.push(fleetMovement);
        }
    }

    if (allFleetMovements.length === 0)
    {
        const element: ReactElement =
        (
            <div className="border border-gray-400 rounded px-6 py-3 text-sm text-center text-gray-400 w-full h-24 flex items-center justify-center">
                No fleet movements.
            </div>
        );

        return element;
    }

    const movementElements: ReactElement[] = allFleetMovements.map((fleetMovement: CoreType.FleetMovement): ReactElement =>
    {
        return renderFleetMovementRow(fleetMovement, publicPlanetRows);
    });

    const element: ReactElement =
    (
        <div className="flex flex-col gap-2 w-full">
            {movementElements}
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
    const selectedPlanetDataPredicted: CoreType.PlanetData = SelectedPlanet.getSelectedPlanetDataPredicted(props.clientDataStateResult.psController[0]);

    const shipName: string = ThingType.getSpecificThingName(ThingType.ship(shipType));
    const ownedQuantity: number = ShipData.getShipQuantity(selectedPlanetDataPredicted, shipType);
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
                {HelperElement.renderQuantityInput(shipType, 0, ownedQuantity, requestedQuantity, selectedPlanetDataPredicted, setRequestedQuantity)}
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

function useIdState(max: number): [number, (value: number) => void, (e: ChangeEvent<HTMLInputElement>) => void]
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

function getFleetViewTargetAddress(data: FleetViewData): GameType.PlanetAddress
{
    const targetAddress: GameType.PlanetAddress =
    {
        galaxy: data.galaxyIdState[0],
        system: data.systemIdState[0],
        slot: data.slotIdState[0],
    };

    return targetAddress;
}

function renderPlanetTargetInput(props: FleetViewProps, data: FleetViewData): ReactElement
{
    const playerData: CoreType.PlayerData = props.clientDataStateResult.psController[0].predictedDBData;
    const originPlanetId: number = data.planetData.planetRow.id;
    const ownedPlanetDatas: CoreType.PlanetData[] = playerData.planetDatas.filter(
        (planetData: CoreType.PlanetData): boolean => planetData.planetRow.id !== originPlanetId
    );

    const handleOwnedPlanetSelect = (e: ChangeEvent<HTMLSelectElement>): void =>
    {
        const selectedPlanetId: number = Number.parseInt(e.target.value, 10);
        const selectedPlanetData: CoreType.PlanetData | undefined = ownedPlanetDatas.find(
            (planetData: CoreType.PlanetData): boolean => planetData.planetRow.id === selectedPlanetId
        );

        if (selectedPlanetData === undefined)
        {
            return;
        }

        data.slotIdState[1](selectedPlanetData.planetRow.slot);
        data.systemIdState[1](selectedPlanetData.planetRow.system);
        data.galaxyIdState[1](selectedPlanetData.planetRow.galaxy);
    };

    const ownedPlanetOptionElements: ReactElement[] = ownedPlanetDatas.map((planetData: CoreType.PlanetData): ReactElement =>
    {
        const planetRow: DBType.PlanetRow = planetData.planetRow;
        const addressLabel: string = GameType.formatPlanetAddress(planetRow.galaxy, planetRow.system, planetRow.slot);

        const optionElement: ReactElement =
        (
            <option key={planetRow.id} value={planetRow.id}>
                {addressLabel}
            </option>
        );

        return optionElement;
    });

    const element: ReactElement =
    (
        <div>
            <div className="text-sm font-normal text-white">
                Target planet (galaxy/system/slot)
            </div>
            <div className="flex flex-row items-center gap-2">
                <input
                    type="number"
                    min={1}
                    max={GameType.GALAXY_COUNT}
                    value={data.galaxyIdState[0]}
                    onChange={data.galaxyIdState[2]}
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
                    max={GameType.SLOT_COUNT}
                    value={data.slotIdState[0]}
                    onChange={data.slotIdState[2]}
                    className="border border-gray-400 px-2 py-1 rounded bg-white text-black w-14 text-center"
                    placeholder="G"
                />
                <select
                    value=""
                    onChange={handleOwnedPlanetSelect}
                    className="border border-gray-400 px-2 py-1 rounded bg-white text-black"
                >
                    <option value="" disabled>My planets</option>
                    {ownedPlanetOptionElements}
                </select>
            </div>
        </div>
    );

    return element;
}

function renderFleetMaxResource(props: FleetViewProps, data: FleetViewData): ReactElement
{
    const originAddress: GameType.PlanetAddress = CoreType.getPlanetAddress(data.planetData);
    const targetAddress: GameType.PlanetAddress = getFleetViewTargetAddress(data);
    const fuelSpaceData: { totalFuel: number, availableSpace: number } = FleetData.computeFleetFuelAndSpace(originAddress, targetAddress, data.requestedShipQuantitiesState.requestedQuantities, props.clientDataStateResult.sdsController[0]);
    const totalShipsRequested: number = MathHelp.calculateTotalQuantityMap(data.requestedShipQuantitiesState.requestedQuantities);

    let travelTimeElement: ReactElement | null = null;

    if (totalShipsRequested > 0)
    {
        const durationSeconds: number = FleetMovementDuration.computeFleetMovementDurationSecondsFromAddresses(originAddress, targetAddress, data.requestedShipQuantitiesState.requestedQuantities, props.clientDataStateResult.sdsController[0]);
        const formattedDuration: string = TimeFormat.formatRemainingTimeMs(durationSeconds * 1000);
        travelTimeElement =
        (
            <div className="text-sm font-normal text-white whitespace-nowrap inline-block">
                Travel time: {formattedDuration}
            </div>
        );
    }

    const element: ReactElement =
    (
        <div className="flex flex-col items-center gap-1">
            <div className="text-sm font-normal text-white whitespace-nowrap inline-block">
                Fuel cost: {fuelSpaceData.totalFuel}, available space: {fuelSpaceData.availableSpace}
            </div>
            {travelTimeElement}
        </div>
    );

    return element;
}

function renderFleetResourceRows(props: FleetViewProps, data: FleetViewData): ReactElement
{
    const resourceTypes: number[] = ThingType.getAllSpecificThings(ThingType.Thing.Resource);
    
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
    const ownedResourceQuantity: number = Math.floor(ResourceData.getResourceQuantity(data.planetData, resourceType));

    const originAddress: GameType.PlanetAddress = CoreType.getPlanetAddress(data.planetData);
    const targetAddress: GameType.PlanetAddress = getFleetViewTargetAddress(data);

    const fuelRequirements: Map<number, number> = FleetData.calculateTotalFleetFuel(originAddress, targetAddress, data.requestedShipQuantitiesState.requestedQuantities, props.clientDataStateResult.sdsController[0]);
    const totalFuel: number = MathHelp.calculateTotalQuantityMap(fuelRequirements);
    const totalFleetSpace: number = FleetData.calculateTotalFleetSpace(data.requestedShipQuantitiesState.requestedQuantities);
    const specificFuelResource: number = fuelRequirements.get(resourceType) ?? 0;

    let otherResourcesRequested: number = 0;
    for (const [otherType, otherQty] of data.requestedResourceQuantitiesState.requestedQuantities)
    {
        if (otherType !== resourceType)
        {
            otherResourcesRequested += otherQty;
        }
    }

    const availableSpaceForThisResource: number = Math.max(totalFleetSpace - otherResourcesRequested - totalFuel, 0);
    const maxResourcePossible: number = Math.max(0, Math.min(ownedResourceQuantity - specificFuelResource, availableSpaceForThisResource));

    const handleFillMax = (): void =>
    {
        data.requestedResourceQuantitiesState.setRequestedQuantity(resourceType, maxResourcePossible);
    };

    const element: ReactElement =
    (
        <div key={resourceType} className="flex flex-row items-center justify-start gap-2 h-10 w-full text-sm">
            <span className="font-semibold text-white w-16 text-left">
                {resourceName}
            </span>
            <div>
                {HelperElement.renderQuantityInput(resourceType, 0, maxResourcePossible, requestedResourceQuantity, data.planetData, data.requestedResourceQuantitiesState.setRequestedQuantity)}
            </div>
            <button
                onClick={handleFillMax}
                className="text-blue-400 hover:text-blue-300 font-normal underline"
            >
                (max: {maxResourcePossible})
            </button>
        </div>
    );

    return element;
}

function renderFleetActionChoice(props: FleetViewProps, data: FleetViewData): ReactElement
{
    const selectedAction: number = data.fleetActionState[0];
    const setSelectedAction: (value: number) => void = data.fleetActionState[1];

    const totalShipsRequested: number = MathHelp.calculateTotalQuantityMap(data.requestedShipQuantitiesState.requestedQuantities);

    const targetPlanetAddress: GameType.PlanetAddress = getFleetViewTargetAddress(data);

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
        return FleetData.canExecuteFleetActionOnTargetAddress(data.planetData, data.playerData, targetOwnerPlayerId, data.requestedShipQuantitiesState.requestedQuantities, actionId);
    });

    const isSelectedActionValid: boolean = validActionIds.includes(selectedAction);
    const originAddress: GameType.PlanetAddress = CoreType.getPlanetAddress(data.planetData);
    const isSamePlanet: boolean = GameType.isSameAddress(originAddress, targetPlanetAddress);
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
            data.planetData.planetRow.id,
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

                <div className="w-px bg-gray-400 h-80 my-0" />

                <div className="flex flex-col items-center gap-2 px-6">
                    {renderFleetActionInput(props, data)}
                </div>

                <div className="w-px bg-gray-400 h-80 my-0" />

                <div className="flex flex-col items-center gap-2 px-6">
                    {renderFleetMovementsSection(props)}
                </div>
            </div>
        </div>
    );
    return element;
}
//#endregion

export function FleetView(props: FleetViewProps): ReactElement
{
    const selectedPlanetId: number = props.clientDataStateResult.psController[0].selectedPlanetId;
    const galaxyIdState: [number, (value: number) => void, (e: ChangeEvent<HTMLInputElement>) => void] = useIdState(GameType.GALAXY_COUNT);
    const systemIdState: [number, (value: number) => void, (e: ChangeEvent<HTMLInputElement>) => void] = useIdState(GameType.SYSTEM_COUNT);
    const slotIdState: [number, (value: number) => void, (e: ChangeEvent<HTMLInputElement>) => void] = useIdState(GameType.SLOT_COUNT);
    const requestedShipQuantitiesState: HelperElement.RequestedQuantitiesState = HelperElement.useRequestedQuantities();
    const requestedResourceQuantitiesState: HelperElement.RequestedQuantitiesState = HelperElement.useRequestedQuantities();
    const fleetActionState: [number, (value: number) => void] = useState<number>(GameType.FLEET_ACTION_STATION);
    const sendErrorState: [string | null, (value: string | null) => void] = useState<string | null>(null);

    useEffect((): void =>
    {
        requestedShipQuantitiesState.resetRequestedQuantities();
        requestedResourceQuantitiesState.resetRequestedQuantities();
        galaxyIdState[1](1);
        systemIdState[1](1);
        slotIdState[1](1);
        fleetActionState[1](GameType.FLEET_ACTION_STATION);
        sendErrorState[1](null);
    }, [selectedPlanetId]);

    try
    {
        const fleetViewData: FleetViewData =
        {
            planetData: SelectedPlanet.getSelectedPlanetDataPredicted(props.clientDataStateResult.psController[0]),
            playerData: props.clientDataStateResult.psController[0].predictedDBData,
            galaxyIdState: galaxyIdState,
            systemIdState: systemIdState,
            slotIdState: slotIdState,
            requestedShipQuantitiesState: requestedShipQuantitiesState,
            requestedResourceQuantitiesState: requestedResourceQuantitiesState,
            fleetActionState: fleetActionState,
            sendErrorState: sendErrorState,
        }
        return renderFleetViewLayout(props, fleetViewData);
    }
    catch (error: unknown)
    {
        console.error("⚠️:", error);
        return <HelperElements.EmptyElement />;
    }
}
