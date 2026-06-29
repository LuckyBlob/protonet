"use client";

import { ReactElement, ChangeEvent, useState, useEffect } from "react";

import * as UseClientDataState from "@/lib/use/useClientDataState";
import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as HelperElements from "@/components/helpers/helperElements";
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

function renderNameEditor(props: CurrentPlanetViewProps, planetData: CoreType.PlanetData, nameInput: string, setNameInput: (value: string) => void): ReactElement
{
    const planetId: number = planetData.planetRow.id;
    const defaultName: string = StaticDataHelper.formatPlanetAddress(planetData.planetRow.galaxy, planetData.planetRow.system, planetData.planetRow.slot, planetData.planetRow.zone as GameType.PlanetZone);

    const handleNameChange = (event: ChangeEvent<HTMLInputElement>): void =>
    {
        setNameInput(event.target.value);
    };

    const handleSave = (): void =>
    {
        ClientRequestFunctions.clientTryRenamePlanetRequest(props.clientDataStateResult.psController, planetId, nameInput);
    };

    const element: ReactElement =
    (
        <div className="flex flex-row items-center gap-2">
            <span className="text-sm text-white">Planet name:</span>
            <input
                type="text"
                value={nameInput}
                maxLength={StaticData.MAX_PLANET_NAME_LENGTH}
                placeholder={defaultName}
                onChange={handleNameChange}
                className="border border-gray-400 px-2 py-1 rounded bg-white text-black"
            />
            <button
                onClick={handleSave}
                className="px-4 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
                Save
            </button>
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

function renderBody(props: CurrentPlanetViewProps, planetData: CoreType.PlanetData, nameInput: string, setNameInput: (value: string) => void): ReactElement
{
    const playerData: CoreType.PlayerData = props.clientDataStateResult.psController[0].predictedDBData;

    const element: ReactElement =
    (
        <div className="w-full flex flex-col items-center pt-4 gap-4">
            {renderNameEditor(props, planetData, nameInput, setNameInput)}
            {renderPlanetStats(planetData, playerData)}
            <AbandonPlanetButton.AbandonPlanetButton clientDataStateResult={props.clientDataStateResult} />
        </div>
    );

    return element;
}

//#endregion

export function CurrentPlanetView(props: CurrentPlanetViewProps): ReactElement
{
    try
    {
        const planetDataPredicted: CoreType.PlanetData = SelectedPlanet.getSelectedPlanetDataPredicted(props.clientDataStateResult.psController[0]);
        const planetId: number = planetDataPredicted.planetRow.id;
        const currentName: string = planetDataPredicted.planetRow.name ?? "";

        const nameInputState: [string, (value: string) => void] = useState<string>(currentName);

        useEffect((): void =>
        {
            nameInputState[1](currentName);
        }, [planetId]);

        return renderBody(props, planetDataPredicted, nameInputState[0], nameInputState[1]);
    }
    catch (error: unknown)
    {
        console.error("⚠️:", error);
        return <HelperElements.EmptyElement />;
    }
}
