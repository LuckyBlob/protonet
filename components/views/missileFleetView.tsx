"use client";

import { useEffect, ReactElement } from "react";

import * as SelectedPlanet from "@/lib/localStorage/selectedPlanet";
import * as UseClientDataState from "@/lib/use/useClientDataState";
import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as UnitData from "@/lib/gameplay/dynamicData/planet/unitData";
import * as HelperElement from "@/components/helpers/helperElements";
import * as ThingHelpers from "@/lib/gameplay/coreData/thing/thingHelpers";
import * as ThingDataHelpers from "@/lib/gameplay/coreData/thing/thingDataHelpers";

type MissileFleetViewProps =
{
    clientDataStateResult: UseClientDataState.ClientDataStateResult;
};

const LAUNCHABLE_MISSILE_TYPE: GameType.UnitType = GameType.UnitType.InterplanetaryMissile;

//#region rendering helpers
function renderLaunchableMissileRow(planetData: CoreType.PlanetData, requestedQuantity: number, setRequestedQuantity: (unitType: GameType.UnitType, value: number) => void): ReactElement | null
{
    const ownedQuantity: number = UnitData.getUnitQuantity(planetData, LAUNCHABLE_MISSILE_TYPE);
    if (ownedQuantity === 0)
    {
        return null;
    }

    const unitName: string = ThingDataHelpers.getSpecificThingName(ThingHelpers.unit(LAUNCHABLE_MISSILE_TYPE));
    const cappedRequestedQuantity: number = Math.min(requestedQuantity, ownedQuantity);

    const element: ReactElement =
    (
        <div key={LAUNCHABLE_MISSILE_TYPE} className="flex flex-row items-center border border-gray-400 rounded h-31 w-full">
            <div className="flex flex-col items-center justify-center px-4 py-2 border-r border-gray-400 gap-1 w-[160px] h-full">
                {HelperElement.renderUnitImage(LAUNCHABLE_MISSILE_TYPE)}
                <div className="font-bold text-sm text-center whitespace-nowrap">{unitName}</div>
            </div>

            <div className="flex items-center justify-center h-full px-4 flex-1 gap-3">
                <div className="text-sm font-semibold whitespace-nowrap">{ownedQuantity} owned</div>
                {HelperElement.renderQuantityInput(LAUNCHABLE_MISSILE_TYPE, 0, ownedQuantity, cappedRequestedQuantity, planetData, setRequestedQuantity)}
            </div>
        </div>
    );

    return element;
}

function renderLaunchStump(): ReactElement
{
    const element: ReactElement =
    (
        <div className="flex flex-col items-center justify-center border border-dashed border-gray-500 rounded px-8 py-12 text-center text-gray-400 w-80">
            <div className="text-base font-bold">Missile launch</div>
            <div className="text-sm">Coming soon.</div>
        </div>
    );

    return element;
}

function renderMissileFleetLayout(planetData: CoreType.PlanetData, requestedQuantity: number, setRequestedQuantity: (unitType: GameType.UnitType, value: number) => void): ReactElement
{
    const element: ReactElement =
    (
        <div className="w-full flex flex-col items-center pt-4">
            <div className="flex flex-row items-start justify-center">
                <div className="flex flex-col items-center gap-2 px-6">
                    {renderLaunchableMissileRow(planetData, requestedQuantity, setRequestedQuantity)}
                </div>

                <div className="w-px bg-gray-400 h-80 my-0" />

                <div className="flex flex-col items-center gap-2 px-6">
                    {renderLaunchStump()}
                </div>
            </div>
        </div>
    );

    return element;
}
//#endregion

export function MissileFleetView(props: MissileFleetViewProps): ReactElement
{
    const quantitiesState: HelperElement.RequestedQuantitiesState<GameType.UnitType> = HelperElement.useRequestedQuantities<GameType.UnitType>();
    const selectedPlanetId: number = props.clientDataStateResult.psController[0].selectedPlanetId;

    useEffect((): void =>
    {
        quantitiesState.resetRequestedQuantities();
    }, [selectedPlanetId]);

    try
    {
        const selectedPlanetDataPredicted: CoreType.PlanetData = SelectedPlanet.getSelectedPlanetDataPredicted(props.clientDataStateResult.psController[0]);
        const requestedQuantity: number = quantitiesState.requestedQuantities.get(LAUNCHABLE_MISSILE_TYPE) ?? 0;
        return renderMissileFleetLayout(selectedPlanetDataPredicted, requestedQuantity, quantitiesState.setRequestedQuantity);
    }
    catch (error: unknown)
    {
        console.error("⚠️:", error);
        return <HelperElement.EmptyElement />;
    }
}
