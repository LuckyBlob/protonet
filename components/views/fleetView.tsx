"use client";

import { ReactElement, ChangeEvent, useState, useEffect } from "react";

import * as TimeFormat from "@/lib/helper/timeFormat";
import * as SelectedPlanet from "@/lib/localStorage/selectedPlanet";
import * as UseClientDataState from "@/lib/use/useClientDataState";
import * as ThingType from "@/lib/gameplay/coreData/thing/thingTypes";
import * as ThingHelpers from "@/lib/gameplay/coreData/thing/thingHelpers";
import * as ThingDataHelpers from "@/lib/gameplay/coreData/thing/thingDataHelpers";
import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as HelperElements from "@/components/helpers/helperElements";
import * as FleetData from "@/lib/gameplay/dynamicData/planet/fleet/fleetData";
import * as UnitData from "@/lib/gameplay/dynamicData/planet/unitData";
import * as HelperElement from "@/components/helpers/helperElements";
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
    zoneIdState: [GameType.PlanetZone, (value: GameType.PlanetZone) => void];
    requestedUnitQuantitiesState: HelperElement.RequestedQuantitiesState<GameType.UnitType>;
    requestedResourceQuantitiesState: HelperElement.RequestedQuantitiesState<GameType.ResourceType>;
    fleetActionState: [GameType.FleetActionType, (value: GameType.FleetActionType) => void];
    speedPercentageState: [number, (value: number) => void];
    sendErrorState: [string | null, (value: string | null) => void];
}

//#region rendering helpers
function renderZoneMarker(zone: GameType.PlanetZone): ReactElement | null
{
    if (zone === GameType.PlanetZone.Planet)
    {
        return null;
    }

    const zoneInfo: GameType.PlanetZoneInfo = StaticDataHelper.getPlanetZoneInfo(zone);

    return <img src={`/icons/zone/${zone}_color.png`} alt={zoneInfo.displayName} title={zoneInfo.displayName} className="w-4 h-4 object-contain inline-block align-text-bottom" />;
}

function renderFleetMovementRow(props: FleetViewProps, fleetMovement: CoreType.FleetMovement, playerData: CoreType.PlayerData): ReactElement
{
    const fleetMovementRow: DBType.FleetMovementRow = fleetMovement.fleetMovementRow;
    const originZone: GameType.PlanetZone = fleetMovementRow.planet_origin_zone as GameType.PlanetZone;
    const targetZone: GameType.PlanetZone = fleetMovementRow.planet_target_zone as GameType.PlanetZone;
    const originAddress: string = StaticDataHelper.getDisplayNameForAddress(playerData, { galaxy: fleetMovementRow.planet_origin_galaxy, system: fleetMovementRow.planet_origin_system, slot: fleetMovementRow.planet_origin_slot, zone: originZone });
    const targetAddress: string = StaticDataHelper.getDisplayNameForAddress(playerData, { galaxy: fleetMovementRow.planet_target_galaxy, system: fleetMovementRow.planet_target_system, slot: fleetMovementRow.planet_target_slot, zone: targetZone });
    const actionName: string = ThingDataHelpers.getSpecificThingName(ThingHelpers.fleetAction(fleetMovementRow.fleet_action_type));
    const isReturnTrip: boolean = fleetMovementRow.is_return_trip === 1;
    const remainingMs: number | null = FleetData.getFleetMovementRemainingMs(fleetMovement);

    if (remainingMs === null)
    {
        throw new Error(`Fleet movement ${fleetMovementRow.id} has no started_at or duration_at_start_time.`);
    }

    const isUnknownResult: boolean = remainingMs < 0 && fleetMovement.resolutionState === CoreType.FleetMovementResolution.ResolveResultUnknown;

    const isOwnOutboundInFlight: boolean = (isReturnTrip === false) && (isUnknownResult === false) && (remainingMs > 0) && (fleetMovementRow.player_origin_id === playerData.playerRow.id);

    const handleRecall = (): void =>
    {
        ClientRequestFunctions.clientTryRecallFleetRequest(props.clientDataStateResult.psController, fleetMovementRow.id);
    };

    const recallElement: ReactElement | null = isOwnOutboundInFlight === true
        ? <button type="button" onClick={handleRecall} className="text-blue-400 hover:text-blue-300 underline text-xs">Recall</button>
        : null;

    const element: ReactElement =
    (
        <div key={fleetMovementRow.id} className="border border-gray-400 rounded px-4 py-2 text-sm text-white w-full">
            <div className="flex flex-row items-center gap-1">
                <span>{originAddress}</span>
                {renderZoneMarker(originZone)}
                <span>→</span>
                <span>{targetAddress}</span>
                {renderZoneMarker(targetZone)}
            </div>
            {isUnknownResult ?
            (
                <div className="text-sm font-semibold text-yellow-400">Unknown result.</div>
            ) : (
            <>
                <div>{actionName}{isReturnTrip ? " (return)" : ""}</div>
                <div className="text-gray-400">
                    {TimeFormat.formatRemainingTimeMs(remainingMs)}
                </div>
                {recallElement}
            </>
            )}
        </div>
    );

    return element;
}

function renderFleetMovementsSection(props: FleetViewProps): ReactElement
{
    const planetDataPredicted: CoreType.PlanetData = SelectedPlanet.getSelectedPlanetDataPredicted(props.clientDataStateResult.psController[0]);

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

    const playerData: CoreType.PlayerData = props.clientDataStateResult.psController[0].predictedDBData;

    const movementElements: ReactElement[] = allFleetMovements.map((fleetMovement: CoreType.FleetMovement): ReactElement =>
    {
        return renderFleetMovementRow(props, fleetMovement, playerData);
    });

    const element: ReactElement =
    (
        <div className="flex flex-col gap-2 w-full">
            {movementElements}
        </div>
    );

    return element;
}

function renderFleetUnitRows(props: FleetViewProps, data: FleetViewData): ReactElement
{
    const unitTypes: GameType.UnitType[] = StaticDataHelper.getAllSpecificThings(ThingType.Thing.Unit);

    const rowElements: (ReactElement | null)[] = unitTypes.map((unitType: GameType.UnitType) =>
    {
        const requestedQuantity: number = data.requestedUnitQuantitiesState.requestedQuantities.get(unitType) ?? 0;

        return renderFleetUnitRow(props, unitType, requestedQuantity, data.requestedUnitQuantitiesState.setRequestedQuantity);
    });

    const element: ReactElement =
    (
        <div className="text-sm font-semibold text-white whitespace-nowrap inline-block">
            {rowElements}
        </div>
    );

    return element;
}

function renderFleetUnitRow(props: FleetViewProps, unitType: GameType.UnitType, requestedQuantity: number, setRequestedQuantity: (unitType: GameType.UnitType, value: number) => void): ReactElement | null
{
    const selectedPlanetDataPredicted: CoreType.PlanetData = SelectedPlanet.getSelectedPlanetDataPredicted(props.clientDataStateResult.psController[0]);

    const unitName: string = ThingDataHelpers.getSpecificThingName(ThingHelpers.unit(unitType));
    const ownedQuantity: number = UnitData.getUnitQuantity(selectedPlanetDataPredicted, unitType);
    if (ownedQuantity === 0)
    {
        return null;
    }

    const element: ReactElement =
    (
        <div key={unitType} className="flex flex-row items-center border border-gray-400 rounded h-31 w-full">
            
            <div className="flex flex-col items-center justify-center px-4 py-2 border-r border-gray-400 gap-1 w-[160px] h-full">
                {HelperElement.renderUnitImage(unitType)}
                <div className="font-bold text-sm text-center whitespace-nowrap">{unitName}</div>
            </div>

            <div className="flex flex-col items-center justify-center h-full px-4 gap-1 flex-1">
                {HelperElement.renderQuantityInput(unitType, 0, ownedQuantity, requestedQuantity, selectedPlanetDataPredicted, setRequestedQuantity)}
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
            {renderFleetSpeedChoice(props, data)}
            {renderFleetActionChoice(props, data)}
        </div>
    );

    return element;
}

function renderFleetSpeedChoice(props: FleetViewProps, data: FleetViewData): ReactElement
{
    const speedPercentage: number = data.speedPercentageState[0];
    const setSpeedPercentage: (value: number) => void = data.speedPercentageState[1];

    const speedOptions: number[] = [];
    for (let percentage: number = 100; percentage >= 10; percentage = percentage - 10)
    {
        speedOptions.push(percentage);
    }

    const handleChange = (e: ChangeEvent<HTMLSelectElement>): void =>
    {
        setSpeedPercentage(Number.parseInt(e.target.value, 10));
    };

    const optionElements: ReactElement[] = speedOptions.map((percentage: number): ReactElement =>
    {
        return <option key={percentage} value={percentage}>{percentage}%</option>;
    });

    const element: ReactElement =
    (
        <div className="flex flex-row items-center gap-2 text-sm font-normal text-white">
            <span>Speed:</span>
            <select
                value={speedPercentage}
                onChange={handleChange}
                className="border border-gray-400 px-2 py-1 rounded bg-white text-black"
            >
                {optionElements}
            </select>
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
        zone: data.zoneIdState[0],
    };

    return targetAddress;
}

// The requested unit quantities persist in state across sends (we deliberately don't reset the inputs),
// so after a send — or any drop in owned units — a stored request can exceed what's now on the planet.
// Cap each request to the currently owned amount so the displayed value, fuel/space math, and the send
// payload all stay valid. The underlying state is left untouched, so the old value comes back if units do.
function capRequestedUnitQuantitiesToOwned(requestedUnitQuantities: Map<GameType.UnitType, number>, planetData: CoreType.PlanetData): Map<GameType.UnitType, number>
{
    const cappedUnitQuantities: Map<GameType.UnitType, number> = new Map<GameType.UnitType, number>();

    for (const [unitType, requestedQuantity] of requestedUnitQuantities)
    {
        const ownedQuantity: number = UnitData.getUnitQuantity(planetData, unitType);
        const cappedQuantity: number = Math.min(requestedQuantity, ownedQuantity);

        if (cappedQuantity > 0)
        {
            cappedUnitQuantities.set(unitType, cappedQuantity);
        }
    }

    return cappedUnitQuantities;
}

function renderPlanetTargetInput(props: FleetViewProps, data: FleetViewData): ReactElement
{
    const playerData: CoreType.PlayerData = props.clientDataStateResult.psController[0].predictedDBData;

    const ownedPlanetDatas: CoreType.PlanetData[] = StaticDataHelper.getSelectableZones(playerData.planetDatas);

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
        data.zoneIdState[1](selectedPlanetData.planetRow.zone as GameType.PlanetZone);
    };

    const handleGalaxyInputChange = (e: ChangeEvent<HTMLInputElement>): void =>
    {
        data.galaxyIdState[2](e);
        data.zoneIdState[1](GameType.PlanetZone.Planet);
    };

    const handleSystemInputChange = (e: ChangeEvent<HTMLInputElement>): void =>
    {
        data.systemIdState[2](e);
        data.zoneIdState[1](GameType.PlanetZone.Planet);
    };

    const handleSlotInputChange = (e: ChangeEvent<HTMLInputElement>): void =>
    {
        data.slotIdState[2](e);
        data.zoneIdState[1](GameType.PlanetZone.Planet);
    };

    const zoneTypes: GameType.PlanetZone[] = Array.from(StaticData.PLANET_ZONE_INFOS.keys());
    const zoneIconElements: ReactElement[] = zoneTypes.map((zone: GameType.PlanetZone): ReactElement =>
    {
        const zoneInfo: GameType.PlanetZoneInfo = StaticDataHelper.getPlanetZoneInfo(zone);

        const bodyExists: boolean = playerData.publicPlanetDatas.some((publicPlanetData: CoreType.PublicPlanetData): boolean =>
        {
            return (publicPlanetData.galaxy === data.galaxyIdState[0]) && (publicPlanetData.system === data.systemIdState[0]) && (publicPlanetData.slot === data.slotIdState[0]) && (publicPlanetData.zone === zone);
        });
        const isSelected: boolean = data.zoneIdState[0] === zone;
        const imageVariant: string = bodyExists === true ? "color" : "gray";
        const borderClass: string = isSelected === true ? "border-yellow-400" : "border-transparent";

        const handleZoneSelect = (): void =>
        {
            data.zoneIdState[1](zone);
        };

        const zoneIconElement: ReactElement =
        (
            <button
                key={zone}
                type="button"
                onClick={handleZoneSelect}
                title={zoneInfo.displayName}
                className={`border-2 ${borderClass} rounded p-1 bg-black`}
            >
                <img src={`/icons/zone/${zone}_${imageVariant}.png`} alt={zoneInfo.displayName} className="w-10 h-10 object-contain" />
            </button>
        );

        return zoneIconElement;
    });

    const ownedPlanetOptionElements: ReactElement[] = ownedPlanetDatas.map((planetData: CoreType.PlanetData): ReactElement =>
    {
        const planetRow: DBType.PlanetRow = planetData.planetRow;
        const addressLabel: string = StaticDataHelper.getPlanetDisplayName(planetRow);

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
                    onChange={handleGalaxyInputChange}
                    className="border border-gray-400 px-2 py-1 rounded bg-white text-black w-14 text-center"
                    placeholder="G"
                />
                <span className="text-gray-400 font-bold">:</span>
                <input
                    type="number"
                    min={1}
                    max={StaticData.SYSTEM_COUNT}
                    value={data.systemIdState[0]}
                    onChange={handleSystemInputChange}
                    className="border border-gray-400 px-2 py-1 rounded bg-white text-black w-14 text-center"
                    placeholder="S"
                />
                <span className="text-gray-400 font-bold">:</span>
                <input
                    type="number"
                    min={1}
                    max={StaticData.SLOT_COUNT}
                    value={data.slotIdState[0]}
                    onChange={handleSlotInputChange}
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
            <div className="flex flex-row items-center justify-center gap-2 pt-2">
                {zoneIconElements}
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
    const fuelSpaceData: { totalFuel: number, availableSpace: number } = FleetData.computeFleetFuelAndSpace(originPlayerData, originAddress, targetAddress, data.requestedUnitQuantitiesState.requestedQuantities, props.clientDataStateResult.sdsController[0], data.speedPercentageState[0]);
    const totalUnitsRequested: number = MathHelp.calculateTotalQuantityMap(data.requestedUnitQuantitiesState.requestedQuantities);

    let travelTimeElement: ReactElement | null = null;

    if (totalUnitsRequested > 0)
    {
        const durationSeconds: number = FleetMovementDuration.computeFleetMovementDurationSecondsFromAddresses(originPlayerData, originAddress, targetAddress, data.requestedUnitQuantitiesState.requestedQuantities, props.clientDataStateResult.sdsController[0], data.speedPercentageState[0]);
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

    const fuelRequirements: Map<GameType.ResourceType, number> = FleetData.calculateTotalFleetFuel(playerData, originAddress, targetAddress, data.requestedUnitQuantitiesState.requestedQuantities, props.clientDataStateResult.sdsController[0], data.speedPercentageState[0]);
    const totalFuel: number = MathHelp.calculateTotalQuantityMap(fuelRequirements);
    const totalFleetSpace: number = FleetData.calculateTotalFleetSpace(data.requestedUnitQuantitiesState.requestedQuantities);
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
    const cappedRequestedResourceQuantity: number = Math.min(requestedResourceQuantity, maxResourcePossible);

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
                {HelperElement.renderQuantityInput(resourceType, 0, maxResourcePossible, cappedRequestedResourceQuantity, data.planetData, data.requestedResourceQuantitiesState.setRequestedQuantity)}
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
    const speedPercentage: number = data.speedPercentageState[0];

    const totalUnitsRequested: number = MathHelp.calculateTotalQuantityMap(data.requestedUnitQuantitiesState.requestedQuantities);

    const targetPlanetAddress: GameType.PlanetAddress = getFleetViewTargetAddress(data);

    const publicPlanetDatas: CoreType.PublicPlanetData[] = props.clientDataStateResult.psController[0].dbData.publicPlanetDatas;
    const targetPublicPlanetData: CoreType.PublicPlanetData | null = CoreType.getPublicPlanetDataForAddress(publicPlanetDatas, targetPlanetAddress);
    const targetZoneExists: boolean = targetPublicPlanetData !== null;

    const zoneAssociatedPlanetAddress: GameType.PlanetAddress = { ...targetPlanetAddress, zone: GameType.PlanetZone.Planet };
    const zoneAssociatedPlanetData: CoreType.PublicPlanetData | null = CoreType.getPublicPlanetDataForAddress(publicPlanetDatas, zoneAssociatedPlanetAddress);
    const zoneAssociatedPlanetOwnerPlayerId: number | null = zoneAssociatedPlanetData?.owner_player_id ?? null;

    const validActionIds: GameType.FleetActionType[] = Array.from(StaticData.FLEET_ACTION_INFOS.keys()).filter((actionId: GameType.FleetActionType): boolean =>
    {
        const failedRequirements: RequirementType.Requirement[] = Requirement.getFailedFleetMovementRequirements(data.playerData, actionId, data.planetData.planetRow.id, data.requestedUnitQuantitiesState.requestedQuantities, data.requestedResourceQuantitiesState.requestedQuantities, targetPlanetAddress, zoneAssociatedPlanetOwnerPlayerId, targetZoneExists);
        return failedRequirements.length === 0;
    });

    const isSelectedActionValid: boolean = validActionIds.includes(selectedAction);
    const originAddress: GameType.PlanetAddress = CoreType.getPlanetAddress(data.planetData);
    const isSamePlanet: boolean = StaticDataHelper.isSameAddress(originAddress, targetPlanetAddress);
    const isSendDisabled: boolean = (totalUnitsRequested === 0) || (isSelectedActionValid === false) || (isSamePlanet === true);

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
            data.requestedUnitQuantitiesState.requestedQuantities,
            data.requestedResourceQuantitiesState.requestedQuantities,
            speedPercentage);

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
                    {renderFleetUnitRows(props, data)}
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
    const zoneIdState: [GameType.PlanetZone, (value: GameType.PlanetZone) => void] = useState<GameType.PlanetZone>(GameType.PlanetZone.Planet);
    const requestedUnitQuantitiesState: HelperElement.RequestedQuantitiesState<GameType.UnitType> = HelperElement.useRequestedQuantities<GameType.UnitType>();
    const requestedResourceQuantitiesState: HelperElement.RequestedQuantitiesState<GameType.ResourceType> = HelperElement.useRequestedQuantities<GameType.ResourceType>();
    const fleetActionState: [GameType.FleetActionType, (value: GameType.FleetActionType) => void] = useState<GameType.FleetActionType>(GameType.FleetActionType.Station);
    const speedPercentageState: [number, (value: number) => void] = useState<number>(100);
    const sendErrorState: [string | null, (value: string | null) => void] = useState<string | null>(null);

    useEffect((): void =>
    {
        requestedUnitQuantitiesState.resetRequestedQuantities();
        requestedResourceQuantitiesState.resetRequestedQuantities();
        galaxyIdState[1](1);
        systemIdState[1](1);
        slotIdState[1](1);
        zoneIdState[1](GameType.PlanetZone.Planet);
        fleetActionState[1](GameType.FleetActionType.Station);
        speedPercentageState[1](100);
        sendErrorState[1](null);
    }, [selectedPlanetId]);

    try
    {
        const selectedPlanetData: CoreType.PlanetData = SelectedPlanet.getSelectedPlanetDataPredicted(props.clientDataStateResult.psController[0]);
        const cappedRequestedUnitQuantitiesState: HelperElement.RequestedQuantitiesState<GameType.UnitType> =
        {
            requestedQuantities: capRequestedUnitQuantitiesToOwned(requestedUnitQuantitiesState.requestedQuantities, selectedPlanetData),
            setRequestedQuantity: requestedUnitQuantitiesState.setRequestedQuantity,
            resetRequestedQuantities: requestedUnitQuantitiesState.resetRequestedQuantities,
        };

        const fleetViewData: FleetViewData =
        {
            planetData: selectedPlanetData,
            playerData: props.clientDataStateResult.psController[0].predictedDBData,
            galaxyIdState: galaxyIdState,
            systemIdState: systemIdState,
            slotIdState: slotIdState,
            zoneIdState: zoneIdState,
            requestedUnitQuantitiesState: cappedRequestedUnitQuantitiesState,
            requestedResourceQuantitiesState: requestedResourceQuantitiesState,
            fleetActionState: fleetActionState,
            speedPercentageState: speedPercentageState,
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
