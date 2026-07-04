"use client";

import { useState, useEffect, ChangeEvent, ReactElement } from "react";

import * as SelectedPlanet from "@/lib/localStorage/selectedPlanet";
import * as UseClientDataState from "@/lib/use/useClientDataState";
import * as ClientRequestFunctions from "@/lib/networkRequests/client/clientRequestFunctions";
import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as BuildingData from "@/lib/gameplay/dynamicData/planet/buildingData";
import * as ResourceData from "@/lib/gameplay/dynamicData/planet/resourceData";
import * as SensorPhalanx from "@/lib/gameplay/coreData/formula/sensorPhalanxFormulas";
import * as StaticData from "@/lib/gameplay/coreData/static/staticData";
import * as HelperElements from "@/components/helpers/helperElements";

type SensorPhalanxViewProps =
{
    clientDataStateResult: UseClientDataState.ClientDataStateResult;
};

type NumberFieldState = [number, (value: number) => void];
type StatusFieldState = [string | null, (value: string | null) => void];

function clampNumber(value: number, minimum: number, maximum: number): number
{
    return Math.min(Math.max(value, minimum), maximum);
}

function renderSensorPhalanxBody(props: SensorPhalanxViewProps, moonData: CoreType.PlanetData, targetSystemState: NumberFieldState, targetSlotState: NumberFieldState, statusMessageState: StatusFieldState): ReactElement
{
    const psController: CoreType.PSController = props.clientDataStateResult.psController;
    const sensorPhalanxLevel: number = BuildingData.getBuildingLevel(moonData, GameType.BuildingType.SensorPhalanx);
    const scanRangeSystems: number = SensorPhalanx.computeScanRangeSystems(sensorPhalanxLevel);
    const moonGalaxy: number = moonData.planetRow.galaxy;
    const moonSystem: number = moonData.planetRow.system;

    const availableDeuterium: number = ResourceData.getResourceQuantity(moonData, GameType.ResourceType.Deuterium);
    const canAffordScan: boolean = availableDeuterium >= SensorPhalanx.SCAN_DEUTERIUM_COST;

    const targetSystem: number = targetSystemState[0];
    const targetSlot: number = targetSlotState[0];
    const systemDistance: number = Math.abs(moonSystem - targetSystem);
    const isInRange: boolean = systemDistance <= scanRangeSystems;
    const canScan: boolean = canAffordScan === true && isInRange === true;
    const statusMessage: string | null = statusMessageState[0];

    const handleSystemChange = (event: ChangeEvent<HTMLInputElement>): void =>
    {
        targetSystemState[1](clampNumber(Number(event.target.value), 1, StaticData.SYSTEM_COUNT));
    };

    const handleSlotChange = (event: ChangeEvent<HTMLInputElement>): void =>
    {
        targetSlotState[1](clampNumber(Number(event.target.value), 1, StaticData.SLOT_COUNT));
    };

    const handleScan = async (): Promise<void> =>
    {
        statusMessageState[1]("Scanning...");
        const errorMessage: string | null = await ClientRequestFunctions.clientTryScanRequest(psController, moonData.planetRow.id, moonGalaxy, targetSystem, targetSlot);
        statusMessageState[1](errorMessage === null ? "Scan complete. See Messages for the report." : errorMessage);
    };

    const outOfRangeNotice: ReactElement | null = isInRange === false
        ? <div className="text-sm text-red-400">Target is out of scan range.</div>
        : null;

    const statusNotice: ReactElement | null = statusMessage !== null
        ? <div className="text-sm">{statusMessage}</div>
        : null;

    const scanDisabledReasons: string[] = [];
    if (canAffordScan === false)
    {
        scanDisabledReasons.push(`Not enough deuterium (need ${SensorPhalanx.SCAN_DEUTERIUM_COST}).`);
    }

    const scanButton: ReactElement =
    (
        <button
            type="button"
            onClick={handleScan}
            disabled={canScan === false}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
            Scan (costs {SensorPhalanx.SCAN_DEUTERIUM_COST} deuterium)
        </button>
    );

    const element: ReactElement =
    (
        <div className="w-full flex flex-col items-center gap-4 pt-4 text-white">
            <div className="text-lg font-bold">Sensor Phalanx</div>
            <div className="text-sm">Scan range: +/- {scanRangeSystems} systems (galaxy {moonGalaxy} only)</div>
            <div className="text-sm">Deuterium: {availableDeuterium} / {SensorPhalanx.SCAN_DEUTERIUM_COST} per scan</div>

            <div className="flex flex-row items-end gap-3">
                <label className="flex flex-col text-sm">
                    Galaxy
                    <input type="number" value={moonGalaxy} disabled className="border border-gray-400 rounded px-2 py-1 bg-gray-300 text-black w-20" />
                </label>
                <label className="flex flex-col text-sm">
                    System
                    <input type="number" value={targetSystem} min={1} max={StaticData.SYSTEM_COUNT} onChange={handleSystemChange} className="border border-gray-400 rounded px-2 py-1 bg-white text-black w-20" />
                </label>
                <label className="flex flex-col text-sm">
                    Slot
                    <input type="number" value={targetSlot} min={1} max={StaticData.SLOT_COUNT} onChange={handleSlotChange} className="border border-gray-400 rounded px-2 py-1 bg-white text-black w-20" />
                </label>
            </div>

            {outOfRangeNotice}

            {HelperElements.renderWithTooltip(scanDisabledReasons, scanButton)}

            {statusNotice}
        </div>
    );

    return element;
}

export function SensorPhalanxView(props: SensorPhalanxViewProps): ReactElement
{
    const targetSystemState: NumberFieldState = useState<number>(1);
    const targetSlotState: NumberFieldState = useState<number>(1);
    const statusMessageState: StatusFieldState = useState<string | null>(null);
    const selectedPlanetId: number = props.clientDataStateResult.psController[0].selectedPlanetId;

    useEffect((): void =>
    {
        try
        {
            const moonData: CoreType.PlanetData = SelectedPlanet.getSelectedPlanetDataPredicted(props.clientDataStateResult.psController[0]);
            targetSystemState[1](moonData.planetRow.system);
            targetSlotState[1](moonData.planetRow.slot);
            statusMessageState[1](null);
        }
        catch (error: unknown)
        {
            console.error("⚠️:", error);
        }
    }, [selectedPlanetId]);

    try
    {
        const moonData: CoreType.PlanetData = SelectedPlanet.getSelectedPlanetDataPredicted(props.clientDataStateResult.psController[0]);
        return renderSensorPhalanxBody(props, moonData, targetSystemState, targetSlotState, statusMessageState);
    }
    catch (error: unknown)
    {
        console.error("⚠️:", error);
        return <HelperElements.EmptyElement />;
    }
}
