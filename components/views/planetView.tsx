"use client";

import { ReactElement, ChangeEvent, useState } from "react";

import * as UseClientDataState from "@/lib/use/useClientDataState";
import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as DBType from "@/lib/db/dbTypes";
import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as HelperElements from "@/components/helperElements";
import * as SelectedPlanet from "@/lib/localStorage/selectedPlanet";

type PlanetViewProps =
{
    clientDataStateResult: UseClientDataState.ClientDataStateResult;
};

//#region rendering helpers

function getPlayerUsername(ownerId: number, publicPlayerRows: DBType.PublicPlayerRow[]): string
{
    const publicPlayerRow: DBType.PublicPlayerRow | undefined = publicPlayerRows.find(
        (row: DBType.PublicPlayerRow): boolean => row.id === ownerId
    );

    return publicPlayerRow?.username ?? `Player #${ownerId}`;
}

function renderPlanetRow(slot: number, selectedGalaxy: number, selectedSystem: number, publicPlanetRows: DBType.PublicPlanetRow[], publicPlayerRows: DBType.PublicPlayerRow[]): ReactElement
{
    const publicPlanetRow: DBType.PublicPlanetRow | undefined = publicPlanetRows.find((row: DBType.PublicPlanetRow): boolean =>
    {
        return row.galaxy === selectedGalaxy && row.system === selectedSystem && row.slot === slot;
    });

    const ownershipText: string = (publicPlanetRow === undefined)
        ? "Unowned"
        : `Owned by: ${getPlayerUsername(publicPlanetRow.owner_player_id, publicPlayerRows)}`;

    const element: ReactElement =
    (
        <div key={slot} className="flex flex-row items-center gap-4 px-4 py-2 border border-gray-600 rounded text-sm text-white">
            <span className="font-semibold w-4 text-right">{slot}</span>
            <span className="text-gray-400">|</span>
            <span>{ownershipText}</span>
        </div>
    );

    return element;
}

function renderPlanetGrid(selectedGalaxy: number, selectedSystem: number, playerData: CoreType.PlayerData): ReactElement
{
    const slotNumbers: number[] = Array.from({ length: GameType.SLOT_COUNT }, (_: unknown, index: number): number => index + 1);

    const rowElements: ReactElement[] = slotNumbers.map((slot: number): ReactElement =>
    {
        return renderPlanetRow(slot, selectedGalaxy, selectedSystem, playerData.publicPlanetRows, playerData.publicPlayerRows);
    });

    const element: ReactElement =
    (
        <div className="flex flex-col gap-2">
            {rowElements}
        </div>
    );

    return element;
}

function renderBody(props: PlanetViewProps, selectedGalaxy: number, selectedSystem: number, handleGalaxyChange: (e: ChangeEvent<HTMLSelectElement>) => void, handleSystemChange: (e: ChangeEvent<HTMLSelectElement>) => void): ReactElement
{
    const playerData: CoreType.PlayerData = props.clientDataStateResult.psController[0].predictedDBData;

    const galaxyNumbers: number[] = Array.from({ length: GameType.GALAXY_COUNT }, (_: unknown, index: number): number => index + 1);
    const systemNumbers: number[] = Array.from({ length: GameType.SYSTEM_COUNT }, (_: unknown, index: number): number => index + 1);

    const galaxyOptionElements: ReactElement[] = galaxyNumbers.map((galaxy: number): ReactElement =>
    {
        const optionElement: ReactElement = <option key={galaxy} value={galaxy}>Galaxy {galaxy}</option>;
        return optionElement;
    });

    const systemOptionElements: ReactElement[] = systemNumbers.map((system: number): ReactElement =>
    {
        const optionElement: ReactElement = <option key={system} value={system}>System {system}</option>;
        return optionElement;
    });

    const element: ReactElement =
    (
        <div className="w-full flex flex-col items-center pt-4 gap-4">
            <div className="flex flex-row gap-4">
                <select
                    value={selectedGalaxy}
                    onChange={handleGalaxyChange}
                    className="border border-gray-400 px-2 py-1 rounded bg-white text-black"
                >
                    {galaxyOptionElements}
                </select>
                <select
                    value={selectedSystem}
                    onChange={handleSystemChange}
                    className="border border-gray-400 px-2 py-1 rounded bg-white text-black"
                >
                    {systemOptionElements}
                </select>
            </div>
            {renderPlanetGrid(selectedGalaxy, selectedSystem, playerData)}
        </div>
    );

    return element;
}

//#endregion

export function PlanetView(props: PlanetViewProps): ReactElement
{
    try
    {
        const planetDataPredicted: CoreType.PlanetData = SelectedPlanet.getSelectedPlanetDataPredicted(props.clientDataStateResult.psController[0]);
    
        const selectedGalaxyState: [number, (value: number) => void] = useState<number>(planetDataPredicted.planetRow.galaxy);
        const selectedSystemState: [number, (value: number) => void] = useState<number>(planetDataPredicted.planetRow.system);

        const handleGalaxyChange = (e: ChangeEvent<HTMLSelectElement>): void =>
        {
            const parsedValue: number = Number.parseInt(e.target.value, 10);
            selectedGalaxyState[1](Math.min(Math.max(parsedValue, 1), GameType.GALAXY_COUNT));
        };

        const handleSystemChange = (e: ChangeEvent<HTMLSelectElement>): void =>
        {
            const parsedValue: number = Number.parseInt(e.target.value, 10);
            selectedSystemState[1](Math.min(Math.max(parsedValue, 1), GameType.SYSTEM_COUNT));
        };

        return renderBody(props, selectedGalaxyState[0], selectedSystemState[0], handleGalaxyChange, handleSystemChange);
    }
    catch (error: unknown)
    {
        console.error("⚠️:", error);
        return <HelperElements.EmptyElement />;
    }
}
