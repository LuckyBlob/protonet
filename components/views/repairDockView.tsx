"use client";

import { ReactElement } from "react";

import * as SelectedPlanet from "@/lib/localStorage/selectedPlanet";
import * as UseClientDataState from "@/lib/use/useClientDataState";
import * as ClientRequestFunctions from "@/lib/networkRequests/client/clientRequestFunctions";
import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as PendingRepairData from "@/lib/gameplay/dynamicData/planet/pendingRepairData";
import * as StaticDataHelper from "@/lib/gameplay/coreData/static/staticDataHelpers";
import * as TimeFormat from "@/lib/helper/timeFormat";
import * as HelperElements from "@/components/helpers/helperElements";

type RepairDockViewProps =
{
    clientDataStateResult: UseClientDataState.ClientDataStateResult;
};

function buildRepairUnitSummary(pendingRepair: CoreType.PendingRepair): string
{
    const unitQuantities: Map<GameType.UnitType, number> = PendingRepairData.getPendingRepairUnitQuantities(pendingRepair);
    const summaryParts: string[] = [];
    for (const [unitType, unitQuantity] of unitQuantities)
    {
        summaryParts.push(`${unitQuantity} ${StaticDataHelper.getUnitStats(unitType).displayName}`);
    }

    if (summaryParts.length === 0)
    {
        return "none";
    }

    return summaryParts.join(", ");
}

function renderPendingRepairRow(props: RepairDockViewProps, planetData: CoreType.PlanetData, pendingRepair: CoreType.PendingRepair, now: number): ReactElement
{
    const psController: CoreType.PSController = props.clientDataStateResult.psController;
    const pendingRepairId: number = pendingRepair.pendingRepairRow.id;
    const unitSummary: string = buildRepairUnitSummary(pendingRepair);
    const battleDateLabel: string = new Date(pendingRepair.pendingRepairRow.created_at).toLocaleString();

    const handleStartRepair = async (): Promise<void> =>
    {
        await ClientRequestFunctions.clientTryStartRepairRequest(psController, planetData.planetRow.id, pendingRepairId);
    };

    const handleCollectRepair = async (): Promise<void> =>
    {
        await ClientRequestFunctions.clientTryCollectRepairRequest(psController, planetData.planetRow.id, pendingRepairId);
    };

    const handleBurnWreckField = async (): Promise<void> =>
    {
        const isConfirmed: boolean = window.confirm("Burn this wreck field? The wrecked ships will be lost permanently.");
        if (isConfirmed === false)
        {
            return;
        }

        await ClientRequestFunctions.clientTryBurnWreckFieldRequest(psController, planetData.planetRow.id, pendingRepairId);
    };

    const canBurnWreckField: boolean = PendingRepairData.canBurnWreckField(planetData, now);

    let stateElement: ReactElement;
    if (PendingRepairData.isWreckAwaitingRepair(pendingRepair) === true)
    {
        const canStartRepair: boolean = PendingRepairData.canStartRepair(planetData, pendingRepair, now);

        const startRepairDisabledReasons: string[] = [];
        if (PendingRepairData.getRepairDockLevel(planetData) < 1)
        {
            startRepairDisabledReasons.push("No Repair Dock on this planet.");
        }

        if (PendingRepairData.isAnyRepairInProgress(planetData, now) === true)
        {
            startRepairDisabledReasons.push("Another repair is already in progress.");
        }

        const startRepairButton: ReactElement =
        (
            <button
                type="button"
                onClick={handleStartRepair}
                disabled={canStartRepair === false}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
                Start Repair
            </button>
        );

        stateElement = HelperElements.renderWithTooltip(startRepairDisabledReasons, startRepairButton);
    }
    else if (PendingRepairData.isRepairReady(pendingRepair, now) === true)
    {
        stateElement =
        (
            <button
                type="button"
                onClick={handleCollectRepair}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
            >
                Collect
            </button>
        );
    }
    else
    {
        const remainingMs: number | null = PendingRepairData.getRepairRemainingMs(pendingRepair, now);
        const remainingLabel: string = remainingMs === null ? "" : TimeFormat.formatRemainingTimeMs(remainingMs);
        stateElement = <div className="text-sm">Repairing — ready in {remainingLabel}</div>;
    }

    const burnDisabledReasons: string[] = canBurnWreckField === false ? ["Cannot burn while a repair is in progress."] : [];

    const burnButton: ReactElement =
    (
        <button
            type="button"
            onClick={handleBurnWreckField}
            disabled={canBurnWreckField === false}
            className="px-3 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
            Burn
        </button>
    );

    const element: ReactElement =
    (
        <div className="w-full flex flex-row items-center justify-between gap-4 border border-gray-500 rounded px-4 py-2">
            <div className="flex flex-col text-sm">
                <div className="font-semibold">{unitSummary}</div>
                <div className="text-gray-300">Battle: {battleDateLabel}</div>
            </div>
            <div className="flex flex-row items-center gap-2">
                {stateElement}
                {HelperElements.renderWithTooltip(burnDisabledReasons, burnButton)}
            </div>
        </div>
    );

    return element;
}

function renderRepairDockBody(props: RepairDockViewProps, planetData: CoreType.PlanetData): ReactElement
{
    const repairDockLevel: number = PendingRepairData.getRepairDockLevel(planetData);
    const now: number = Date.now();
    const pendingRepairs: CoreType.PendingRepair[] = planetData.dynamicPlanetData.pendingRepairs;

    const repairRows: ReactElement[] = pendingRepairs.map((pendingRepair: CoreType.PendingRepair): ReactElement =>
    {
        const rowElement: ReactElement =
        (
            <div key={pendingRepair.pendingRepairRow.id} className="w-full">
                {renderPendingRepairRow(props, planetData, pendingRepair, now)}
            </div>
        );

        return rowElement;
    });

    const emptyNotice: ReactElement | null = pendingRepairs.length === 0
        ? <div className="text-sm text-gray-300">No wreck fields to repair.</div>
        : null;

    const element: ReactElement =
    (
        <div className="w-full flex flex-col items-center gap-4 pt-4 text-white">
            <div className="text-lg font-bold">Repair Dock (level {repairDockLevel})</div>
            <div className="text-sm">Repair wrecked ships recovered from battles over this planet or its moon.</div>
            <div className="w-full max-w-2xl flex flex-col gap-2">
                {repairRows}
                {emptyNotice}
            </div>
        </div>
    );

    return element;
}

export function RepairDockView(props: RepairDockViewProps): ReactElement
{
    try
    {
        const planetData: CoreType.PlanetData = SelectedPlanet.getSelectedPlanetDataPredicted(props.clientDataStateResult.psController[0]);
        return renderRepairDockBody(props, planetData);
    }
    catch (error: unknown)
    {
        console.error("⚠️:", error);
        return <HelperElements.EmptyElement />;
    }
}
