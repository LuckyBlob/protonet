"use client";

import { ReactElement } from "react";

import * as UseClientDataState from "@/lib/use/useClientDataState";
import * as ErrorHelp from "@/lib/helper/errorHelp";
import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as HelperElements from "@/components/helpers/helperElements";
import * as InlineTextEditor from "@/components/helpers/inlineTextEditor";
import * as SelectedPlanet from "@/lib/localStorage/selectedPlanet";
import * as StaticData from "@/lib/gameplay/coreData/static/staticData";
import * as StaticDataHelper from "@/lib/gameplay/coreData/static/staticDataHelpers";
import * as CalculatedValueData from "@/lib/gameplay/dynamicData/calculatedValueData";
import * as ClientRequestFunctions from "@/lib/networkRequests/client/clientRequestFunctions";
import * as AbandonPlanetButton from "@/components/helpers/abandonPlanetButton";

type CurrentPlanetViewProps =
{
    clientDataStateResult: UseClientDataState.ClientDataStateResult;
};

//#region rendering helpers

function renderNameEditor(props: CurrentPlanetViewProps, planetData: CoreType.PlanetData, feedbackController: HelperElements.ActionFeedbackController): ReactElement
{
    const planetId: number = planetData.planetRow.id;
    const currentName: string = planetData.planetRow.name ?? "";
    const defaultName: string = StaticDataHelper.formatPlanetAddress(planetData.planetRow.galaxy, planetData.planetRow.system, planetData.planetRow.slot, planetData.planetRow.zone as GameType.PlanetZone);

    const handleSave = async (value: string): Promise<void> =>
    {
        try
        {
            await ClientRequestFunctions.clientTryRenamePlanetRequest(props.clientDataStateResult.psController, planetId, value);
        }
        catch (error: unknown)
        {
            feedbackController.showError(ErrorHelp.getErrorMessage(error));
        }
    };

    const element: ReactElement =
    (
        <div className="flex flex-col items-center gap-1">
            <InlineTextEditor.InlineTextEditor
                key={planetId}
                label="Planet name:"
                initialValue={currentName}
                placeholder={defaultName}
                saveLabel="Save"
                inputType="text"
                maxLength={StaticData.MAX_PLANET_NAME_LENGTH}
                onSave={handleSave}
            />
            {HelperElements.renderActionFeedback(feedbackController)}
        </div>
    );

    return element;
}

function renderPlanetStats(planetData: CoreType.PlanetData, playerData: CoreType.PlayerData): ReactElement
{
    const sizeValueData: CoreType.CalculatedValueData | null = CalculatedValueData.computePlanetValueData(planetData, GameType.PlanetValueType.Size, playerData);
    const totalFields: number = sizeValueData === null ? 0 : sizeValueData.production;
    const usedFields: number = sizeValueData === null ? 0 : sizeValueData.consumption;
    const freeFields: number = totalFields - usedFields;

    const temperatureCelsius: number = StaticDataHelper.kelvinToCelsius(planetData.planetRow.temperature);

    const element: ReactElement =
    (
        <div className="flex flex-col gap-1 text-sm text-white">
            <div>Size: {usedFields} / {totalFields} ({freeFields} free)</div>
            <div>Temperature: {temperatureCelsius}°C</div>
        </div>
    );

    return element;
}

function renderBody(props: CurrentPlanetViewProps, planetData: CoreType.PlanetData, feedbackController: HelperElements.ActionFeedbackController): ReactElement
{
    const playerData: CoreType.PlayerData = props.clientDataStateResult.psController[0].predictedDBData;

    const element: ReactElement =
    (
        <div className="w-full flex flex-col items-center pt-4 gap-4">
            {renderNameEditor(props, planetData, feedbackController)}
            {renderPlanetStats(planetData, playerData)}
            <AbandonPlanetButton.AbandonPlanetButton clientDataStateResult={props.clientDataStateResult} />
        </div>
    );

    return element;
}

//#endregion

export function CurrentPlanetView(props: CurrentPlanetViewProps): ReactElement
{
    const feedbackController: HelperElements.ActionFeedbackController = HelperElements.useActionFeedback();

    try
    {
        const planetDataPredicted: CoreType.PlanetData = SelectedPlanet.getSelectedPlanetDataPredicted(props.clientDataStateResult.psController[0]);

        return renderBody(props, planetDataPredicted, feedbackController);
    }
    catch (error: unknown)
    {
        console.error("⚠️:", error);
        return <HelperElements.EmptyElement />;
    }
}
