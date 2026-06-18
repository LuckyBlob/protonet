"use client";

import { ReactElement, ChangeEvent, useState, useEffect } from "react";

import * as TimeFormat from "@/lib/helper/timeFormat";
import * as SelectedPlanet from "@/lib/localStorage/selectedPlanet";
import * as UseClientDataState from "@/lib/use/useClientDataState";
import * as ThingType from "@/lib/gameplay/coreData/thing/thingTypes";
import * as ThingHelpers from "@/lib/gameplay/coreData/thing/thingHelpers";
import * as ThingDataHelpers from "@/lib/gameplay/coreData/thing/thingDataHelpers";
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
import * as FleetMovementDuration from "@/lib/gameplay/coreData/formula/fleetMovementDurationFormulas";
import * as StaticData from "@/lib/gameplay/coreData/static/staticData";
import * as StaticDataHelper from "@/lib/gameplay/coreData/static/staticDataHelpers";
import * as Requirement from "@/lib/gameplay/coreData/requirement/requirements";
import * as RequirementType from "@/lib/gameplay/coreData/requirement/requirementTypes";

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
    requestedShipQuantitiesState: HelperElement.RequestedQuantitiesState<GameType.ShipType>;
    requestedResourceQuantitiesState: HelperElement.RequestedQuantitiesState<GameType.ResourceType>;
    fleetActionState: [GameType.FleetActionType, (value: GameType.FleetActionType) => void];
    sendErrorState: [string | null, (value: string | null) => void];
}

//#region rendering helpers
function renderFleetMovementRow(fleetMovement: CoreType.FleetMovement, publicPlanetRows: DBType.PublicPlanetRow[]): ReactElement
{
    const fleetMovementRow: DBType.FleetMovementRow = fleetMovement.fleetMovementRow;
    const originAddress: string = StaticDataHelper.formatPlanetAddress(fleetMovementRow.planet_origin_galaxy, fleetMovementRow.planet_origin_system, fleetMovementRow.planet_origin_slot);
    const targetAddress: string = StaticDataHelper.formatPlanetAddress(fleetMovementRow.planet_target_galaxy, fleetMovementRow.planet_target_system, fleetMovementRow.planet_target_slot);
    const actionName: string = ThingDataHelpers.getSpecificThingName(ThingHelpers.fleetAction(fleetMovementRow.fleet_action_type));
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
    const shipTypes: GameType.ShipType[] = StaticDataHelper.getAllSpecificThings(ThingType.Thing.Ship);

    const rowElements: (ReactElement | null)[] = shipTypes.map((shipType: GameType.ShipType) =>
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

function renderFleetShipRow(props: FleetViewProps, shipType: GameType.ShipType, requestedQuantity: number, setRequestedQuantity: (shipType: GameType.ShipType, value: number) => void): ReactElement | null
{
    const selectedPlanetDataPredicted: CoreType.PlanetData = SelectedPlanet.getSelectedPlanetDataPredicted(props.clientDataStateResult.psController[0]);

    const shipName: string = ThingDataHelpers.getSpecificThingName(ThingHelpers.ship(shipType));
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

// The requested ship quantities persist in state across sends (we deliberately don't reset the inputs),
// so after a send — or any drop in owned ships — a stored request can exceed what's now on the planet.
// Cap each request to the currently owned amount so the displayed value, fuel/space math, and the send
// payload all stay valid. The underlying state is left untouched, so the old value comes back if ships do.
function capRequestedShipQuantitiesToOwned(requestedShipQuantities: Map<GameType.ShipType, number>, planetData: CoreType.PlanetData): Map<GameType.ShipType, number>
{
    const cappedShipQuantities: Map<GameType.ShipType, number> = new Map<GameType.ShipType, number>();

    for (const [shipType, requestedQuantity] of requestedShipQuantities)
    {
        const ownedQuantity: number = ShipData.getShipQuantity(planetData, shipType);
        const cappedQuantity: number = Math.min(requestedQuantity, ownedQuantity);

        if (cappedQuantity > 0)
        {
            cappedShipQuantities.set(shipType, cappedQuantity);
        }
    }

    return cappedShipQuantities;
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
        const addressLabel: string = StaticDataHelper.formatPlanetAddress(planetRow.galaxy, planetRow.system, planetRow.slot);

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
                    max={StaticData.GALAXY_COUNT}
                    value={data.galaxyIdState[0]}
                    onChange={data.galaxyIdState[2]}
                    className="border border-gray-400 px-2 py-1 rounded bg-white text-black w-14 text-center"
                    placeholder="G"
                />
                <span className="text-gray-400 font-bold">:</span>
                <input
                    type="number"
                    min={1}
                    max={StaticData.SYSTEM_COUNT}
                    value={data.systemIdState[0]}
                    onChange={data.systemIdState[2]}
                    className="border border-gray-400 px-2 py-1 rounded bg-white text-black w-14 text-center"
                    placeholder="S"
                />
                <span className="text-gray-400 font-bold">:</span>
                <input
                    type="number"
                    min={1}
                    max={StaticData.SLOT_COUNT}
                    value={data.slotIdState[0]}
                    onChange={data.slotIdState[2]}
                    className="border border-gray-400 px-2 py-1 rounded bg-white text-black w-14 text-center"
                    placeholder="P"
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
    const originPlayerData: CoreType.PlayerData = data.playerData;
    const originAddress: GameType.PlanetAddress = CoreType.getPlanetAddress(data.planetData);
    const targetAddress: GameType.PlanetAddress = getFleetViewTargetAddress(data);
    const fuelSpaceData: { totalFuel: number, availableSpace: number } = FleetData.computeFleetFuelAndSpace(originPlayerData, originAddress, targetAddress, data.requestedShipQuantitiesState.requestedQuantities, props.clientDataStateResult.sdsController[0]);
    const totalShipsRequested: number = MathHelp.calculateTotalQuantityMap(data.requestedShipQuantitiesState.requestedQuantities);

    let travelTimeElement: ReactElement | null = null;

    if (totalShipsRequested > 0)
    {
        const durationSeconds: number = FleetMovementDuration.computeFleetMovementDurationSecondsFromAddresses(originPlayerData, originAddress, targetAddress, data.requestedShipQuantitiesState.requestedQuantities, props.clientDataStateResult.sdsController[0]);
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
    const resourceTypes: GameType.ResourceType[] = StaticDataHelper.getAllSpecificThings(ThingType.Thing.Resource);

    const rowElements: (ReactElement | null)[] = resourceTypes.map((resourceType: GameType.ResourceType) =>
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

function renderFleetResourceRow(props: FleetViewProps, resourceType: GameType.ResourceType, data: FleetViewData): ReactElement | null
{
    const requestedResourceQuantity: number = data.requestedResourceQuantitiesState.requestedQuantities.get(resourceType) ?? 0;

    const playerData: CoreType.PlayerData = data.playerData;
    const resourceName: string = ThingDataHelpers.getSpecificThingName(ThingHelpers.resource(resourceType));
    const ownedResourceQuantity: number = Math.floor(ResourceData.getResourceQuantity(data.planetData, resourceType));

    const originAddress: GameType.PlanetAddress = CoreType.getPlanetAddress(data.planetData);
    const targetAddress: GameType.PlanetAddress = getFleetViewTargetAddress(data);

    const fuelRequirements: Map<GameType.ResourceType, number> = FleetData.calculateTotalFleetFuel(playerData, originAddress, targetAddress, data.requestedShipQuantitiesState.requestedQuantities, props.clientDataStateResult.sdsController[0]);
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
    const selectedAction: GameType.FleetActionType = data.fleetActionState[0];
    const setSelectedAction: (value: GameType.FleetActionType) => void = data.fleetActionState[1];

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

    const validActionIds: GameType.FleetActionType[] = Array.from(StaticData.FLEET_ACTION_INFOS.keys()).filter((actionId: GameType.FleetActionType): boolean =>
    {
        const failedRequirements: RequirementType.Requirement[] = Requirement.getFailedFleetMovementRequirements(data.playerData, actionId, data.planetData.planetRow.id, data.requestedShipQuantitiesState.requestedQuantities, data.requestedResourceQuantitiesState.requestedQuantities, targetPlanetAddress, targetOwnerPlayerId);
        return failedRequirements.length === 0;
    });

    const isSelectedActionValid: boolean = validActionIds.includes(selectedAction);
    const originAddress: GameType.PlanetAddress = CoreType.getPlanetAddress(data.planetData);
    const isSamePlanet: boolean = StaticDataHelper.isSameAddress(originAddress, targetPlanetAddress);
    const isSendDisabled: boolean = (totalShipsRequested === 0) || (isSelectedActionValid === false) || (isSamePlanet === true);

    const handleChange = (e: ChangeEvent<HTMLSelectElement>): void =>
    {
        const parsedValue: number = Number.parseInt(e.target.value, 10);
        setSelectedAction(parsedValue as GameType.FleetActionType);
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

    const optionElements: ReactElement[] = validActionIds.map((actionId: GameType.FleetActionType): ReactElement =>
    {
        const actionName: string = ThingDataHelpers.getSpecificThingName(ThingHelpers.fleetAction(actionId));

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
    const galaxyIdState: [number, (value: number) => void, (e: ChangeEvent<HTMLInputElement>) => void] = useIdState(StaticData.GALAXY_COUNT);
    const systemIdState: [number, (value: number) => void, (e: ChangeEvent<HTMLInputElement>) => void] = useIdState(StaticData.SYSTEM_COUNT);
    const slotIdState: [number, (value: number) => void, (e: ChangeEvent<HTMLInputElement>) => void] = useIdState(StaticData.SLOT_COUNT);
    const requestedShipQuantitiesState: HelperElement.RequestedQuantitiesState<GameType.ShipType> = HelperElement.useRequestedQuantities<GameType.ShipType>();
    const requestedResourceQuantitiesState: HelperElement.RequestedQuantitiesState<GameType.ResourceType> = HelperElement.useRequestedQuantities<GameType.ResourceType>();
    const fleetActionState: [GameType.FleetActionType, (value: GameType.FleetActionType) => void] = useState<GameType.FleetActionType>(GameType.FleetActionType.Station);
    const sendErrorState: [string | null, (value: string | null) => void] = useState<string | null>(null);

    useEffect((): void =>
    {
        requestedShipQuantitiesState.resetRequestedQuantities();
        requestedResourceQuantitiesState.resetRequestedQuantities();
        galaxyIdState[1](1);
        systemIdState[1](1);
        slotIdState[1](1);
        fleetActionState[1](GameType.FleetActionType.Station);
        sendErrorState[1](null);
    }, [selectedPlanetId]);

    try
    {
        const selectedPlanetData: CoreType.PlanetData = SelectedPlanet.getSelectedPlanetDataPredicted(props.clientDataStateResult.psController[0]);
        const cappedRequestedShipQuantitiesState: HelperElement.RequestedQuantitiesState<GameType.ShipType> =
        {
            requestedQuantities: capRequestedShipQuantitiesToOwned(requestedShipQuantitiesState.requestedQuantities, selectedPlanetData),
            setRequestedQuantity: requestedShipQuantitiesState.setRequestedQuantity,
            resetRequestedQuantities: requestedShipQuantitiesState.resetRequestedQuantities,
        };

        const fleetViewData: FleetViewData =
        {
            planetData: selectedPlanetData,
            playerData: props.clientDataStateResult.psController[0].predictedDBData,
            galaxyIdState: galaxyIdState,
            systemIdState: systemIdState,
            slotIdState: slotIdState,
            requestedShipQuantitiesState: cappedRequestedShipQuantitiesState,
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
