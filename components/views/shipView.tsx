"use client";

import { ReactElement } from "react";

import * as TimeFormat from "@/lib/helper/timeFormat";
import * as SelectedPlanet from "@/lib/localStorage/selectedPlanet";
import * as UseClientDataState from "@/lib/use/useClientDataState";
import * as ThingType from "@/lib/gameplay/coreData/type/thingTypes";
import * as PlayerDataType from "@/lib/gameplay/gameplayData/player/playerDataTypes";
import * as HelperElements from "@/components/helperElements";

type ShipViewProps =
{
    clientDataStateResult: UseClientDataState.ClientDataStateResult;
};

//#region rendering helpers
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

    const completesAt: number = selectedFullPlanetDataPredicted.planetRow.ship_construction_batch_completes_at;
    const remainingMs: number = (completesAt - Date.now());

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

function renderShipViewLayout(selectedFullPlanetDataPredicted: PlayerDataType.FullPlanetData): ReactElement
{
    const element: ReactElement =
    (
        <div className="w-full flex flex-col items-center pt-4">
            <div className="flex flex-row items-stretch justify-center gap-8">
                <div className="flex flex-col gap-2 min-w-[320px]">
                    <div className="text-center font-semibold pb-2">
						Ship Construction Queue
					</div>
                    {renderActiveConstructionSection(selectedFullPlanetDataPredicted)}
                </div>

                <div className="w-px bg-gray-400 self-stretch my-0" />

                <div className="flex flex-col gap-2 min-w-[320px]">
                    <div className="text-center font-semibold pb-2">
						Fleet movements
					</div>
                    {renderFleetMovementsSection()}
                </div>
            </div>
        </div>
    );

    return element;
}
//#endregion

export function ShipView(props: ShipViewProps): ReactElement
{
    try
    {
        const selectedFullPlanetDataPredicted: PlayerDataType.FullPlanetData = SelectedPlanet.getSelectedFullPlanetDataPredicted(props.clientDataStateResult.psController[0]);
        return renderShipViewLayout(selectedFullPlanetDataPredicted);
    }
    catch (error: unknown)
    {
        console.error("⚠️:", error);
        return <HelperElements.EmptyElement />;
    }
}
