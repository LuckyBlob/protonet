"use client";

import { ReactElement, ChangeEvent, useState } from "react";

import * as UseClientDataState from "@/lib/use/useClientDataState";
import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as DBType from "@/lib/db/dbTypes";
import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as HelperElements from "@/components/helperElements";
import * as SelectedPlanet from "@/lib/localStorage/selectedPlanet";
import * as StaticData from "@/lib/gameplay/coreData/static/staticData";
import * as StaticDataHelper from "@/lib/gameplay/coreData/static/staticDataHelpers";
import * as ShipData from "@/lib/gameplay/dynamicData/planet/shipData";
import * as ResourceData from "@/lib/gameplay/dynamicData/planet/resourceData";
import * as FleetData from "@/lib/gameplay/dynamicData/planet/fleet/fleetData";
import * as Requirement from "@/lib/gameplay/coreData/requirement/requirements";
import * as RequirementType from "@/lib/gameplay/coreData/requirement/requirementTypes";
import * as ClientRequestFunctions from "@/lib/networkRequests/client/clientRequestFunctions";

const ONE_PROBE_SHIP_QUANTITIES: Map<GameType.ShipType, number> = new Map<GameType.ShipType, number>([[GameType.ShipType.EspionageProbe, 1]]);
const NO_TRANSPORTED_RESOURCES: Map<GameType.ResourceType, number> = new Map<GameType.ResourceType, number>();

// One-line outcome of a galaxy-view spy click: the message to show and whether it was a failure.
type SpyFeedback =
{
    message: string;
    isError: boolean;
};

// Everything a galaxy-view row needs to evaluate and launch a one-probe spy mission against its target.
type GalaxyViewContext =
{
    playerData: CoreType.PlayerData;
    originPlanetData: CoreType.PlanetData;
    serverData: CoreType.ServerData;
    psController: CoreType.PSController;
    setSendFeedback: (value: SpyFeedback | null) => void;
};

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

function canSendEspionageProbe(context: GalaxyViewContext, targetPlanetAddress: GameType.PlanetAddress, targetZoneExists: boolean, zoneAssociatedPlanetOwnerPlayerId: number | null): boolean
{
    if (ShipData.getShipQuantity(context.originPlanetData, GameType.ShipType.EspionageProbe) < 1)
    {
        return false;
    }

    const originAddress: GameType.PlanetAddress = CoreType.getPlanetAddress(context.originPlanetData);
    if (StaticDataHelper.isSameAddress(originAddress, targetPlanetAddress) === true)
    {
        return false;
    }

    const failedRequirements: RequirementType.Requirement[] = Requirement.getFailedFleetMovementRequirements(context.playerData, GameType.FleetActionType.Espionage, context.originPlanetData.planetRow.id, ONE_PROBE_SHIP_QUANTITIES, NO_TRANSPORTED_RESOURCES, targetPlanetAddress, zoneAssociatedPlanetOwnerPlayerId, targetZoneExists);
    if (failedRequirements.length > 0)
    {
        return false;
    }

    const fuelRequirements: Map<GameType.ResourceType, number> = FleetData.calculateTotalFleetFuel(context.playerData, originAddress, targetPlanetAddress, ONE_PROBE_SHIP_QUANTITIES, context.serverData);
    if (ResourceData.hasResourceQuantities(context.originPlanetData, fuelRequirements) === false)
    {
        return false;
    }

    return true;
}

function renderEspionageIndicator(context: GalaxyViewContext, planetPublicPlanetData: CoreType.PublicPlanetData | null, targetPlanetAddress: GameType.PlanetAddress): ReactElement | null
{
    if (planetPublicPlanetData === null)
    {
        return null;
    }

    const canSpy: boolean = canSendEspionageProbe(context, targetPlanetAddress, true, planetPublicPlanetData.owner_player_id);
    const variant: string = canSpy === true ? "color" : "gray";
    const title: string = canSpy === true ? "Send 1 espionage probe" : "Cannot send an espionage probe here";

    const handleSpyClick = async (): Promise<void> =>
    {
        if (canSpy === false)
        {
            return;
        }

        const errorMessage: string | null = await ClientRequestFunctions.clientTrySendFleetRequest(context.psController, context.originPlanetData.planetRow.id, targetPlanetAddress, GameType.FleetActionType.Espionage, ONE_PROBE_SHIP_QUANTITIES, NO_TRANSPORTED_RESOURCES);

        if (errorMessage === null)
        {
            const targetAddressLabel: string = StaticDataHelper.formatPlanetAddress(targetPlanetAddress.galaxy, targetPlanetAddress.system, targetPlanetAddress.slot, targetPlanetAddress.zone);
            context.setSendFeedback({ message: `Espionage probe sent to ${targetAddressLabel}.`, isError: false });
            return;
        }

        context.setSendFeedback({ message: errorMessage, isError: true });
    };

    const cursorClass: string = canSpy === true ? "cursor-pointer" : "cursor-default";

    const element: ReactElement =
    (
        <img
            src={`/icons/fleetAction/${GameType.FleetActionType.Espionage}_${variant}.png`}
            alt="Espionage"
            title={title}
            onClick={handleSpyClick}
            className={`w-4 h-4 object-contain ${cursorClass}`}
        />
    );

    return element;
}

function renderPlanetRow(context: GalaxyViewContext, slot: number, selectedGalaxy: number, selectedSystem: number, publicPlanetDatas: CoreType.PublicPlanetData[], publicPlayerRows: DBType.PublicPlayerRow[]): ReactElement
{
    const planetPublicPlanetData: CoreType.PublicPlanetData | null = CoreType.getPublicPlanetDataForAddress(publicPlanetDatas, { galaxy: selectedGalaxy, system: selectedSystem, slot: slot, zone: GameType.PlanetZone.Planet });
    const moonPublicPlanetData: CoreType.PublicPlanetData | null = CoreType.getPublicPlanetDataForAddress(publicPlanetDatas, { galaxy: selectedGalaxy, system: selectedSystem, slot: slot, zone: GameType.PlanetZone.Moon });
    const debrisPublicPlanetData: CoreType.PublicPlanetData | null = CoreType.getPublicPlanetDataForAddress(publicPlanetDatas, { galaxy: selectedGalaxy, system: selectedSystem, slot: slot, zone: GameType.PlanetZone.DebrisField });

    const hasMoon: boolean = moonPublicPlanetData !== null;

    const ownershipText: string = (planetPublicPlanetData === null)
        ? "Unowned"
        : `Owned by: ${getPlayerUsername(planetPublicPlanetData.owner_player_id, publicPlayerRows)}`;

    const moonIndicator: ReactElement | null = hasMoon === true
        ? <img src="/icons/zone/2_color.png" alt="Moon" title="Moon present" className="w-4 h-4 object-contain" />
        : null;

    const debrisIndicator: ReactElement | null = renderDebrisIndicator(debrisPublicPlanetData);

    const targetPlanetAddress: GameType.PlanetAddress = { galaxy: selectedGalaxy, system: selectedSystem, slot: slot, zone: GameType.PlanetZone.Planet };
    const espionageIndicator: ReactElement | null = renderEspionageIndicator(context, planetPublicPlanetData, targetPlanetAddress);

    const element: ReactElement =
    (
        <div key={slot} className="flex flex-row items-center gap-4 px-4 py-2 border border-gray-600 rounded text-sm text-white">
            <span className="font-semibold w-4 text-right">{slot}</span>
            <span className="text-gray-400">|</span>
            <span>{ownershipText}</span>
            {moonIndicator}
            {debrisIndicator}
            {espionageIndicator}
        </div>
    );

    return element;
}

function renderDebrisIndicator(debrisPublicPlanetData: CoreType.PublicPlanetData | null): ReactElement | null
{
    if (debrisPublicPlanetData === null)
    {
        return null;
    }

    const debrisMetal: number = Math.floor(debrisPublicPlanetData.dynamicPlanetData.resourceQuantity.get(GameType.ResourceType.Metal) ?? 0);
    const debrisCrystal: number = Math.floor(debrisPublicPlanetData.dynamicPlanetData.resourceQuantity.get(GameType.ResourceType.Crystal) ?? 0);

    const element: ReactElement =
    (
        <div className="flex flex-row items-center gap-1" title="Debris field present">
            <img src="/icons/zone/3_color.png" alt="Debris Field" className="w-4 h-4 object-contain" />
            <span className="text-xs text-gray-300">{debrisMetal} M / {debrisCrystal} C</span>
        </div>
    );

    return element;
}

function renderPlanetGrid(context: GalaxyViewContext, selectedGalaxy: number, selectedSystem: number, playerData: CoreType.PlayerData): ReactElement
{
    const slotNumbers: number[] = Array.from({ length: StaticData.SLOT_COUNT }, (_: unknown, index: number): number => index + 1);

    const rowElements: ReactElement[] = slotNumbers.map((slot: number): ReactElement =>
    {
        return renderPlanetRow(context, slot, selectedGalaxy, selectedSystem, playerData.publicPlanetDatas, playerData.publicPlayerRows);
    });

    const element: ReactElement =
    (
        <div className="flex flex-col gap-2">
            {rowElements}
        </div>
    );

    return element;
}

function renderBody(props: PlanetViewProps, originPlanetData: CoreType.PlanetData, sendFeedbackState: [SpyFeedback | null, (value: SpyFeedback | null) => void], selectedGalaxy: number, selectedSystem: number, handleGalaxyChange: (e: ChangeEvent<HTMLSelectElement>) => void, handleSystemChange: (e: ChangeEvent<HTMLSelectElement>) => void): ReactElement
{
    const playerData: CoreType.PlayerData = props.clientDataStateResult.psController[0].predictedDBData;

    const context: GalaxyViewContext =
    {
        playerData: playerData,
        originPlanetData: originPlanetData,
        serverData: props.clientDataStateResult.sdsController[0],
        psController: props.clientDataStateResult.psController,
        setSendFeedback: sendFeedbackState[1],
    };

    const sendFeedback: SpyFeedback | null = sendFeedbackState[0];
    const feedbackColorClass: string = (sendFeedback !== null && sendFeedback.isError === true) ? "text-red-400" : "text-green-400";
    const feedbackElement: ReactElement | null = (sendFeedback !== null)
        ? <div className={`text-sm font-normal ${feedbackColorClass}`}>{sendFeedback.message}</div>
        : null;

    const galaxyNumbers: number[] = Array.from({ length: StaticData.GALAXY_COUNT }, (_: unknown, index: number): number => index + 1);
    const systemNumbers: number[] = Array.from({ length: StaticData.SYSTEM_COUNT }, (_: unknown, index: number): number => index + 1);

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
            {renderPlanetGrid(context, selectedGalaxy, selectedSystem, playerData)}
            {feedbackElement}
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
        const sendFeedbackState: [SpyFeedback | null, (value: SpyFeedback | null) => void] = useState<SpyFeedback | null>(null);

        const handleGalaxyChange = (e: ChangeEvent<HTMLSelectElement>): void =>
        {
            const parsedValue: number = Number.parseInt(e.target.value, 10);
            selectedGalaxyState[1](Math.min(Math.max(parsedValue, 1), StaticData.GALAXY_COUNT));
        };

        const handleSystemChange = (e: ChangeEvent<HTMLSelectElement>): void =>
        {
            const parsedValue: number = Number.parseInt(e.target.value, 10);
            selectedSystemState[1](Math.min(Math.max(parsedValue, 1), StaticData.SYSTEM_COUNT));
        };

        return renderBody(props, planetDataPredicted, sendFeedbackState, selectedGalaxyState[0], selectedSystemState[0], handleGalaxyChange, handleSystemChange);
    }
    catch (error: unknown)
    {
        console.error("⚠️:", error);
        return <HelperElements.EmptyElement />;
    }
}
