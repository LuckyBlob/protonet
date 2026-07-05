"use client";

import { useEffect, ReactElement } from "react";

import * as SelectedPlanet from "@/lib/localStorage/selectedPlanet";
import * as UseClientDataState from "@/lib/use/useClientDataState";
import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as HelperElements from "@/components/helpers/helperElements";
import * as StaticDataHelper from "@/lib/gameplay/coreData/static/staticDataHelpers";
import * as UnitConstructionData from "@/lib/gameplay/dynamicData/planet/unitConstructionData";
import * as Requirement from "@/lib/gameplay/coreData/requirement/requirements";
import * as RequirementType from "@/lib/gameplay/coreData/requirement/requirementTypes";
import * as UnitBuildElements from "@/components/helpers/unitBuildElements";

const PREVIEW_MAX_UNIT_LINES: number = 7;
const PREVIEW_MAX_RESOURCE_LINES: number = 7;
const PREVIEW_TEXT_LINE_HEIGHT_PX: number = 20;
const PREVIEW_TOTAL_TIME_LINE_PX: number = 20;
const PREVIEW_COUNTDOWN_LINE_PX: number = 20;
const PREVIEW_BUTTON_PX: number = 40;
const PREVIEW_BOX_VERTICAL_PADDING_PX: number = 32;
const PREVIEW_STACK_GAPS_PX: number = 32;

const PREVIEW_RESERVE_HEIGHT_PX =
    (PREVIEW_MAX_UNIT_LINES * PREVIEW_TEXT_LINE_HEIGHT_PX)
    + (PREVIEW_MAX_RESOURCE_LINES * PREVIEW_TEXT_LINE_HEIGHT_PX)
    + PREVIEW_TOTAL_TIME_LINE_PX
    + PREVIEW_COUNTDOWN_LINE_PX
    + PREVIEW_BUTTON_PX
    + PREVIEW_BOX_VERTICAL_PADDING_PX
    + PREVIEW_STACK_GAPS_PX;

const SHIPYARD_INSUFFICIENT_TEXT: string = "Rien, esti de pauvre.";

type ShipyardViewProps =
{
    clientDataStateResult: UseClientDataState.ClientDataStateResult;
};

//#region rendering helpers
function renderShipyardLayout(previewSlot: ReactElement, buildRowElements: ReactElement, activeConstructionElements: ReactElement): ReactElement
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

            <div className="w-full flex flex-col items-center pt-4">
                <div className="flex flex-row items-stretch justify-center gap-8">
                    <div className="flex flex-col gap-2 min-w-[320px]">
                        <div className="relative flex flex-col gap-2 items-center">
                            {buildRowElements}
                        </div>
                    </div>

                    <div className="w-px bg-gray-400 self-stretch my-0" />

                    <div className="flex flex-col gap-2 min-w-[320px]">
                        {activeConstructionElements}
                    </div>
                </div>
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

function renderShipyardBody(props: ShipyardViewProps, planetDataPredicted: CoreType.PlanetData, quantitiesState: HelperElements.RequestedQuantitiesState<GameType.UnitType>, feedbackController: HelperElements.ActionFeedbackController): ReactElement
{
    const serverData: CoreType.ServerData = props.clientDataStateResult.sdsController[0];
    const playerData: CoreType.PlayerData = props.clientDataStateResult.psController[0].predictedDBData;
    const buildableUnitTypes: GameType.UnitType[] = StaticDataHelper.getUnitsByQueueType(GameType.UnitConstructionQueueType.Shipyard);

    const computeBuildableShipyardQuantities: UnitBuildElements.ComputeBuildableUnitQuantities =
        (planet: CoreType.PlanetData, requestedUnitQuantities: Map<GameType.UnitType, number>): Map<GameType.UnitType, number> =>
        {
            const affordableQuantities: Map<GameType.UnitType, number> = UnitConstructionData.computeMaxAffordableUnitQuantities(planet, requestedUnitQuantities);
            const requirementContext: RequirementType.RequirementContext =
            {
                playerData: playerData,
                planetId: planet.planetRow.id,
            };
            return Requirement.capUnitQuantitiesByBuildCount(requirementContext, affordableQuantities);
        };

    const requestedMap: Map<GameType.UnitType, number> = UnitBuildElements.buildRequestedUnitQuantitiesMap(buildableUnitTypes, quantitiesState.requestedQuantities);
    const hasRequestedData: boolean = requestedMap.size > 0;

    const onBuildAll: () => Promise<void> = UnitBuildElements.createBuildUnitsHandler(props.clientDataStateResult, planetDataPredicted, requestedMap, quantitiesState.resetRequestedQuantities, feedbackController);

    const previewContent: ReactElement | null = UnitBuildElements.renderBuildPreviewContent(planetDataPredicted, serverData, requestedMap, computeBuildableShipyardQuantities, SHIPYARD_INSUFFICIENT_TEXT);
    const buildButton: ReactElement | null = UnitBuildElements.renderBuildButton(planetDataPredicted, requestedMap, hasRequestedData, onBuildAll, computeBuildableShipyardQuantities, SHIPYARD_INSUFFICIENT_TEXT);
    const previewSlot: ReactElement = renderPreviewSlot(previewContent, buildButton);
    const buildRowElements: ReactElement = UnitBuildElements.renderUnitBuildSections(playerData, buildableUnitTypes, planetDataPredicted, serverData, quantitiesState.requestedQuantities, quantitiesState.setRequestedQuantity);
    const activeConstructionElements: ReactElement = UnitBuildElements.renderUnitConstructionSection(planetDataPredicted, serverData, GameType.UnitConstructionQueueType.Shipyard, "No unit construction in progress.");
    const shipyardLayout: ReactElement = renderShipyardLayout(previewSlot, buildRowElements, activeConstructionElements);

    const element: ReactElement =
    (
        <div className="w-full flex flex-col items-center gap-4">
            {HelperElements.renderActionFeedback(feedbackController)}
            {shipyardLayout}
        </div>
    );

    return element;
}

export function ShipyardView(props: ShipyardViewProps): ReactElement
{
    const feedbackController: HelperElements.ActionFeedbackController = HelperElements.useActionFeedback();
    const quantitiesState: HelperElements.RequestedQuantitiesState<GameType.UnitType> = HelperElements.useRequestedQuantities<GameType.UnitType>();
    const selectedPlanetId: number = props.clientDataStateResult.psController[0].selectedPlanetId;

    useEffect((): void =>
    {
        quantitiesState.resetRequestedQuantities();
    }, [selectedPlanetId]);

    try
    {
        const selectedPlanetDataPredicted: CoreType.PlanetData = SelectedPlanet.getSelectedPlanetDataPredicted(props.clientDataStateResult.psController[0]);
        return renderShipyardBody(props, selectedPlanetDataPredicted, quantitiesState, feedbackController);
    }
    catch (error: unknown)
    {
        console.error("⚠️:", error);
        return <HelperElements.EmptyElement />;
    }
}
