"use client";

import { useEffect, ReactElement } from "react";

import * as SelectedPlanet from "@/lib/localStorage/selectedPlanet";
import * as ErrorHelp from "@/lib/helper/errorHelp";
import * as UseClientDataState from "@/lib/use/useClientDataState";
import * as ClientRequestFunctions from "@/lib/networkRequests/client/clientRequestFunctions";
import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as UnitData from "@/lib/gameplay/dynamicData/planet/unitData";
import * as StaticDataHelper from "@/lib/gameplay/coreData/static/staticDataHelpers";
import * as HelperElements from "@/components/helpers/helperElements";
import * as UnitConstructionData from "@/lib/gameplay/dynamicData/planet/unitConstructionData";
import * as MissileSpaceData from "@/lib/gameplay/dynamicData/planet/missileSpaceData";
import * as Requirement from "@/lib/gameplay/coreData/requirement/requirements";
import * as RequirementType from "@/lib/gameplay/coreData/requirement/requirementTypes";
import * as UnitBuildElements from "@/components/helpers/unitBuildElements";

const MISSILE_INSUFFICIENT_TEXT: string = "Not enough resources or space.";

type MissileSiloViewProps =
{
    clientDataStateResult: UseClientDataState.ClientDataStateResult;
};

//#region rendering helpers
function renderCapacityReadout(planetData: CoreType.PlanetData, playerData: CoreType.PlayerData): ReactElement
{
    const availableSpace: number = MissileSpaceData.computeFreeMissileSpace(planetData, playerData);
    const totalSpace: number = MissileSpaceData.computeMissileSpaceCapacity(planetData, playerData);

    const element: ReactElement =
    (
        <div className="text-sm font-semibold text-white">
            Missile space: {availableSpace} / {totalSpace}
        </div>
    );

    return element;
}

function renderDestroyButton(props: MissileSiloViewProps, unitType: GameType.UnitType, requestedQuantity: number, planetData: CoreType.PlanetData, setRequestedQuantity: (unitType: GameType.UnitType, value: number) => void, feedbackController: HelperElements.ActionFeedbackController): ReactElement
{
    const ownedQuantity: number = UnitData.getUnitQuantity(planetData, unitType);
    const destroyableQuantity: number = Math.min(requestedQuantity, ownedQuantity);
    const isUsable: boolean = destroyableQuantity > 0;

    const handleDestroy = async (): Promise<void> =>
    {
        if (destroyableQuantity <= 0)
        {
            return;
        }

        setRequestedQuantity(unitType, destroyableQuantity);

        try
        {
            await ClientRequestFunctions.clientTryDestroyMissilesRequest(props.clientDataStateResult.psController, planetData.planetRow.id, new Map<GameType.UnitType, number>([[unitType, destroyableQuantity]]));
        }
        catch (error: unknown)
        {
            feedbackController.showError(ErrorHelp.getErrorMessage(error));
        }
    };

    const usableClassName: string = "px-4 py-2 bg-red-600 text-white rounded hover:bg-red-500";
    const disabledClassName: string = "px-4 py-2 bg-gray-400 text-white rounded cursor-not-allowed";

    const destroyDisabledReasons: string[] = isUsable === false ? ["Enter a quantity to destroy."] : [];

    const destroyButton: ReactElement =
    (
        <button
            onClick={handleDestroy}
            disabled={isUsable === false}
            className={isUsable === true ? usableClassName : disabledClassName}
        >
            Destroy
        </button>
    );

    return HelperElements.renderWithTooltip(destroyDisabledReasons, destroyButton);
}
//#endregion

function renderMissileSiloBody(props: MissileSiloViewProps, planetDataPredicted: CoreType.PlanetData, quantitiesState: HelperElements.RequestedQuantitiesState<GameType.UnitType>, feedbackController: HelperElements.ActionFeedbackController): ReactElement
{
    const serverData: CoreType.ServerData = props.clientDataStateResult.sdsController[0];
    const playerData: CoreType.PlayerData = props.clientDataStateResult.psController[0].predictedDBData;
    const missileUnitTypes: GameType.UnitType[] = StaticDataHelper.getUnitsByQueueType(GameType.UnitConstructionQueueType.MissileSilo);

    const computeBuildableMissileQuantities: UnitBuildElements.ComputeBuildableUnitQuantities =
        (planet: CoreType.PlanetData, requestedUnitQuantities: Map<GameType.UnitType, number>): Map<GameType.UnitType, number> =>
        {
            const affordableQuantities: Map<GameType.UnitType, number> = UnitConstructionData.computeMaxAffordableUnitQuantities(planet, requestedUnitQuantities);
            const storableQuantities: Map<GameType.UnitType, number> = MissileSpaceData.computeMaxStorableMissileQuantities(planet, playerData, affordableQuantities);
            const requirementContext: RequirementType.RequirementContext =
            {
                playerData: playerData,
                planetId: planet.planetRow.id,
            };
            return Requirement.capUnitQuantitiesByBuildCount(requirementContext, storableQuantities);
        };

    const renderDestroyAction: UnitBuildElements.RenderRowEndAction =
        (unitType: GameType.UnitType, requestedQuantity: number, planetData: CoreType.PlanetData): ReactElement =>
        {
            return renderDestroyButton(props, unitType, requestedQuantity, planetData, quantitiesState.setRequestedQuantity, feedbackController);
        };

    const requestedBuildMap: Map<GameType.UnitType, number> = UnitBuildElements.buildRequestedUnitQuantitiesMap(missileUnitTypes, quantitiesState.requestedQuantities);
    const hasRequestedData: boolean = requestedBuildMap.size > 0;

    const onBuildAll: () => Promise<void> = UnitBuildElements.createBuildUnitsHandler(props.clientDataStateResult, planetDataPredicted, requestedBuildMap, quantitiesState.resetRequestedQuantities, feedbackController);

    const previewContent: ReactElement | null = UnitBuildElements.renderBuildPreviewContent(planetDataPredicted, serverData, requestedBuildMap, computeBuildableMissileQuantities, MISSILE_INSUFFICIENT_TEXT);
    const buildButton: ReactElement | null = UnitBuildElements.renderBuildButton(planetDataPredicted, requestedBuildMap, hasRequestedData, onBuildAll, computeBuildableMissileQuantities, MISSILE_INSUFFICIENT_TEXT);
    const buildSections: ReactElement = UnitBuildElements.renderUnitBuildSections(playerData, missileUnitTypes, planetDataPredicted, serverData, quantitiesState.requestedQuantities, quantitiesState.setRequestedQuantity, renderDestroyAction);
    const constructionSection: ReactElement = UnitBuildElements.renderUnitConstructionSection(planetDataPredicted, serverData, GameType.UnitConstructionQueueType.MissileSilo, "No missile construction in progress.");

    const element: ReactElement =
    (
        <div className="w-full flex flex-col items-center gap-4 pt-4">
            {HelperElements.renderActionFeedback(feedbackController)}
            {renderCapacityReadout(planetDataPredicted, playerData)}

            <div className="flex flex-col items-center justify-center gap-4 min-h-[120px]">
                {previewContent}
                {buildButton}
            </div>

            <div className="flex flex-row items-start justify-center gap-8">
                <div className="flex flex-col gap-2 min-w-[320px]">
                    {buildSections}
                </div>

                <div className="w-px bg-gray-400 self-stretch" />

                <div className="flex flex-col gap-2 min-w-[320px]">
                    {constructionSection}
                </div>
            </div>
        </div>
    );

    return element;
}

export function MissileSiloView(props: MissileSiloViewProps): ReactElement
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
        return renderMissileSiloBody(props, selectedPlanetDataPredicted, quantitiesState, feedbackController);
    }
    catch (error: unknown)
    {
        console.error("⚠️:", error);
        return <HelperElements.EmptyElement />;
    }
}
