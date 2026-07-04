"use client";

import { useState, useEffect, ChangeEvent, ReactElement } from "react";

import * as SelectedPlanet from "@/lib/localStorage/selectedPlanet";
import * as UseClientDataState from "@/lib/use/useClientDataState";
import * as ClientRequestFunctions from "@/lib/networkRequests/client/clientRequestFunctions";
import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as BuildingData from "@/lib/gameplay/dynamicData/planet/buildingData";
import * as UnitData from "@/lib/gameplay/dynamicData/planet/unitData";
import * as ThingHelpers from "@/lib/gameplay/coreData/thing/thingHelpers";
import * as ThingDataHelpers from "@/lib/gameplay/coreData/thing/thingDataHelpers";
import * as StaticDataHelper from "@/lib/gameplay/coreData/static/staticDataHelpers";
import * as TimeFormat from "@/lib/helper/timeFormat";
import * as HelperElements from "@/components/helpers/helperElements";

type JumpGateViewProps =
{
    clientDataStateResult: UseClientDataState.ClientDataStateResult;
};

type DestinationFieldState = [number | null, (value: number | null) => void];
type StatusFieldState = [string | null, (value: string | null) => void];

function getJumpableDestinationMoons(playerData: CoreType.PlayerData, sourceMoonId: number): CoreType.PlanetData[]
{
    return playerData.planetDatas.filter((planetData: CoreType.PlanetData): boolean =>
    {
        return planetData.planetRow.zone === GameType.PlanetZone.Moon
            && planetData.planetRow.id !== sourceMoonId
            && BuildingData.getBuildingLevel(planetData, GameType.BuildingType.JumpGate) >= 1;
    });
}

function getOwnedUnitTypes(planetData: CoreType.PlanetData): GameType.UnitType[]
{
    const ownedUnitTypes: GameType.UnitType[] = [];
    for (const [unitType, unitQuantity] of planetData.dynamicPlanetData.unitQuantity)
    {
        if (unitQuantity > 0)
        {
            ownedUnitTypes.push(unitType);
        }
    }

    return ownedUnitTypes;
}

function renderUnitRow(unitType: GameType.UnitType, ownedQuantity: number, requestedQuantity: number, setRequestedQuantity: (unitType: GameType.UnitType, value: number) => void): ReactElement
{
    const unitName: string = ThingDataHelpers.getSpecificThingName(ThingHelpers.unit(unitType));

    const handleQuantityChange = (event: ChangeEvent<HTMLInputElement>): void =>
    {
        const parsedValue: number = Number(event.target.value);
        const clampedValue: number = Math.min(Math.max(parsedValue, 0), ownedQuantity);
        setRequestedQuantity(unitType, clampedValue);
    };

    const handleMax = (): void =>
    {
        setRequestedQuantity(unitType, ownedQuantity);
    };

    const element: ReactElement =
    (
        <div key={unitType} className="flex flex-row items-center gap-3 text-sm">
            <span className="min-w-40">{unitName}</span>
            <span className="text-gray-300">owned {ownedQuantity}</span>
            <input
                type="number"
                value={requestedQuantity}
                min={0}
                max={ownedQuantity}
                onChange={handleQuantityChange}
                className="border border-gray-400 rounded px-2 py-1 bg-white text-black w-24"
            />
            <button type="button" onClick={handleMax} className="text-xs underline hover:text-gray-200">max</button>
        </div>
    );

    return element;
}

function renderJumpGateBody(props: JumpGateViewProps, sourceMoonData: CoreType.PlanetData, quantitiesState: HelperElements.RequestedQuantitiesState<GameType.UnitType>, destinationMoonIdState: DestinationFieldState, statusMessageState: StatusFieldState): ReactElement
{
    const psController: CoreType.PSController = props.clientDataStateResult.psController;
    const playerData: CoreType.PlayerData = psController[0].predictedDBData;
    const now: number = Date.now();

    const sourceReadyAt: number = sourceMoonData.planetRow.jump_gate_ready_at;
    const isSourceOnCooldown: boolean = now < sourceReadyAt;

    const destinationMoons: CoreType.PlanetData[] = getJumpableDestinationMoons(playerData, sourceMoonData.planetRow.id);
    const selectedDestinationId: number | null = destinationMoonIdState[0] !== null
        ? destinationMoonIdState[0]
        : (destinationMoons.length > 0 ? destinationMoons[0].planetRow.id : null);
    const selectedDestination: CoreType.PlanetData | undefined = destinationMoons.find((planetData: CoreType.PlanetData): boolean => planetData.planetRow.id === selectedDestinationId);
    const isDestinationOnCooldown: boolean = selectedDestination !== undefined && now < selectedDestination.planetRow.jump_gate_ready_at;

    const ownedUnitTypes: GameType.UnitType[] = getOwnedUnitTypes(sourceMoonData);
    const hasRequestedUnits: boolean = quantitiesState.requestedQuantities.size > 0;
    const canJump: boolean = isSourceOnCooldown === false && isDestinationOnCooldown === false && selectedDestination !== undefined && hasRequestedUnits === true;
    const statusMessage: string | null = statusMessageState[0];

    const handleDestinationChange = (event: ChangeEvent<HTMLSelectElement>): void =>
    {
        destinationMoonIdState[1](Number(event.target.value));
    };

    const handleJump = async (): Promise<void> =>
    {
        if (selectedDestinationId === null)
        {
            return;
        }

        statusMessageState[1]("Jumping...");
        const errorMessage: string | null = await ClientRequestFunctions.clientTryJumpGateRequest(psController, sourceMoonData.planetRow.id, selectedDestinationId, quantitiesState.requestedQuantities);
        if (errorMessage === null)
        {
            quantitiesState.resetRequestedQuantities();
            statusMessageState[1]("Jump complete.");
            return;
        }

        statusMessageState[1](errorMessage);
    };

    const cooldownNotice: ReactElement | null = isSourceOnCooldown === true
        ? <div className="text-sm text-yellow-400">Jump Gate cooldown: {TimeFormat.formatRemainingTimeMs(sourceReadyAt - now)}</div>
        : null;

    const destinationCooldownNotice: ReactElement | null = isDestinationOnCooldown === true && selectedDestination !== undefined
        ? <div className="text-sm text-yellow-400">Destination cooldown: {TimeFormat.formatRemainingTimeMs(selectedDestination.planetRow.jump_gate_ready_at - now)}</div>
        : null;

    const noDestinationNotice: ReactElement | null = destinationMoons.length === 0
        ? <div className="text-sm text-gray-300">No other moon with a Jump Gate to jump to.</div>
        : null;

    const statusNotice: ReactElement | null = statusMessage !== null
        ? <div className="text-sm">{statusMessage}</div>
        : null;

    const unitRows: ReactElement[] = ownedUnitTypes.map((unitType: GameType.UnitType): ReactElement =>
    {
        const ownedQuantity: number = UnitData.getUnitQuantity(sourceMoonData, unitType);
        const requestedQuantity: number = quantitiesState.requestedQuantities.get(unitType) ?? 0;
        return renderUnitRow(unitType, ownedQuantity, requestedQuantity, quantitiesState.setRequestedQuantity);
    });

    const unitsSection: ReactElement = ownedUnitTypes.length > 0
        ? <div className="flex flex-col gap-2">{unitRows}</div>
        : <div className="text-sm text-gray-300">No units stationed on this moon.</div>;

    const destinationSelect: ReactElement = destinationMoons.length > 0
        ? (
            <select value={selectedDestinationId ?? undefined} onChange={handleDestinationChange} className="border border-gray-400 rounded px-2 py-1 bg-white text-black">
                {destinationMoons.map((planetData: CoreType.PlanetData): ReactElement =>
                {
                    return <option key={planetData.planetRow.id} value={planetData.planetRow.id}>{StaticDataHelper.getPlanetDisplayName(planetData.planetRow)}</option>;
                })}
            </select>
        )
        : <span className="text-sm text-gray-300">none</span>;

    const jumpDisabledReasons: string[] = [];
    if (isSourceOnCooldown === true)
    {
        jumpDisabledReasons.push("Jump Gate is on cooldown.");
    }

    if (isDestinationOnCooldown === true)
    {
        jumpDisabledReasons.push("Destination Jump Gate is on cooldown.");
    }

    if (selectedDestination === undefined)
    {
        jumpDisabledReasons.push("No destination moon selected.");
    }

    if (hasRequestedUnits === false)
    {
        jumpDisabledReasons.push("Select at least one unit to jump.");
    }

    const jumpButton: ReactElement =
    (
        <button
            type="button"
            onClick={handleJump}
            disabled={canJump === false}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
            Jump
        </button>
    );

    const element: ReactElement =
    (
        <div className="w-full flex flex-col items-center gap-4 pt-4 text-white">
            <div className="text-lg font-bold">Jump Gate</div>
            <div className="text-sm">Ships only, no resources. No deuterium cost.</div>

            {cooldownNotice}

            <div className="flex flex-row items-center gap-2 text-sm">
                <span>Destination:</span>
                {destinationSelect}
            </div>

            {destinationCooldownNotice}
            {noDestinationNotice}

            {unitsSection}

            {HelperElements.renderWithTooltip(jumpDisabledReasons, jumpButton)}

            {statusNotice}
        </div>
    );

    return element;
}

export function JumpGateView(props: JumpGateViewProps): ReactElement
{
    const quantitiesState: HelperElements.RequestedQuantitiesState<GameType.UnitType> = HelperElements.useRequestedQuantities<GameType.UnitType>();
    const destinationMoonIdState: DestinationFieldState = useState<number | null>(null);
    const statusMessageState: StatusFieldState = useState<string | null>(null);
    const selectedPlanetId: number = props.clientDataStateResult.psController[0].selectedPlanetId;

    useEffect((): void =>
    {
        quantitiesState.resetRequestedQuantities();
        destinationMoonIdState[1](null);
        statusMessageState[1](null);
    }, [selectedPlanetId]);

    try
    {
        const sourceMoonData: CoreType.PlanetData = SelectedPlanet.getSelectedPlanetDataPredicted(props.clientDataStateResult.psController[0]);
        return renderJumpGateBody(props, sourceMoonData, quantitiesState, destinationMoonIdState, statusMessageState);
    }
    catch (error: unknown)
    {
        console.error("⚠️:", error);
        return <HelperElements.EmptyElement />;
    }
}
