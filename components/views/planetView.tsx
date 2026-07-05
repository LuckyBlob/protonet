"use client";

import { ReactElement, ChangeEvent, useState, useEffect } from "react";

import * as UseClientDataState from "@/lib/use/useClientDataState";
import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as HelperElements from "@/components/helpers/helperElements";
import * as SelectedPlanet from "@/lib/localStorage/selectedPlanet";
import * as StaticData from "@/lib/gameplay/coreData/static/staticData";
import * as StaticDataHelper from "@/lib/gameplay/coreData/static/staticDataHelpers";
import * as UnitData from "@/lib/gameplay/dynamicData/planet/unitData";
import * as PlayerSettings from "@/lib/gameplay/dynamicData/player/playerSettingsData";
import * as ResourceData from "@/lib/gameplay/dynamicData/planet/resourceData";
import * as FleetData from "@/lib/gameplay/dynamicData/planet/fleet/fleetData";
import * as Requirement from "@/lib/gameplay/coreData/requirement/requirements";
import * as RequirementType from "@/lib/gameplay/coreData/requirement/requirementTypes";
import * as ClientRequestFunctions from "@/lib/networkRequests/client/clientRequestFunctions";
import * as ErrorHelp from "@/lib/helper/errorHelp";

const NO_TRANSPORTED_RESOURCES: Map<GameType.ResourceType, number> = new Map<GameType.ResourceType, number>();

// Everything a galaxy-view row needs to evaluate and launch a one-probe spy mission against its target.
type GalaxyViewContext =
{
    playerData: CoreType.PlayerData;
    originPlanetData: CoreType.PlanetData;
    serverData: CoreType.ServerData;
    psController: CoreType.PSController;
    feedbackController: HelperElements.ActionFeedbackController;
};

type PlanetViewProps =
{
    clientDataStateResult: UseClientDataState.ClientDataStateResult;
};

//#region rendering helpers

function getPlayerUsername(ownerId: number, publicPlayerDatas: CoreType.PublicPlayerData[]): string
{
    const publicPlayerRow: CoreType.PublicPlayerData | undefined = publicPlayerDatas.find(
        (row: CoreType.PublicPlayerData): boolean => row.id === ownerId
    );

    return publicPlayerRow?.username ?? `Player #${ownerId}`;
}

function getEspionageProbeQuantities(context: GalaxyViewContext): Map<GameType.UnitType, number>
{
    const availableProbes: number = UnitData.getUnitQuantity(context.originPlanetData, GameType.UnitType.EspionageProbe);
    const configuredProbesPerSend: number = PlayerSettings.getProbesPerSend(context.playerData);
    const probesToSend: number = Math.max(1, Math.min(configuredProbesPerSend, availableProbes));

    return new Map<GameType.UnitType, number>([[GameType.UnitType.EspionageProbe, probesToSend]]);
}

function getEspionageProbeFailureReasons(context: GalaxyViewContext, targetPlanetAddress: GameType.PlanetAddress, targetZoneExists: boolean, zoneAssociatedPlanetOwnerPlayerId: number | null): string[]
{
    const reasons: string[] = [];

    if (UnitData.getUnitQuantity(context.originPlanetData, GameType.UnitType.EspionageProbe) < 1)
    {
        reasons.push("No espionage probes available.");
    }

    const originAddress: GameType.PlanetAddress = CoreType.getPlanetAddress(context.originPlanetData);
    if (StaticDataHelper.isSameAddress(originAddress, targetPlanetAddress) === true)
    {
        reasons.push("Origin and target are the same planet.");
    }

    const probeQuantities: Map<GameType.UnitType, number> = getEspionageProbeQuantities(context);

    const requirementContext: RequirementType.RequirementContext =
    {
        playerData: context.playerData,
        planetId: context.originPlanetData.planetRow.id,
        unitQuantities: probeQuantities,
        transportedResourceQuantities: NO_TRANSPORTED_RESOURCES,
        targetPlanetAddress: targetPlanetAddress,
        zoneAssociatedPlanetOwnerPlayerId: zoneAssociatedPlanetOwnerPlayerId,
        targetZoneExists: targetZoneExists,
    };
    const espionageFailedRequirements: RequirementType.Requirement[] = Requirement.getFailedFleetMovementRequirements(requirementContext, GameType.FleetActionType.Espionage);
    reasons.push(...Requirement.getRequirementDescriptions(espionageFailedRequirements, requirementContext));

    const fuelRequirements: Map<GameType.ResourceType, number> = FleetData.calculateTotalFleetFuel(context.playerData, originAddress, targetPlanetAddress, probeQuantities, context.serverData);
    if (ResourceData.hasResourceQuantities(context.originPlanetData, fuelRequirements) === false)
    {
        reasons.push("Not enough fuel.");
    }

    return reasons;
}

function renderEspionageIndicator(context: GalaxyViewContext, planetPublicPlanetData: CoreType.PublicPlanetData | null, targetPlanetAddress: GameType.PlanetAddress): ReactElement | null
{
    if (planetPublicPlanetData === null)
    {
        return null;
    }

    const failureReasons: string[] = getEspionageProbeFailureReasons(context, targetPlanetAddress, true, planetPublicPlanetData.owner_player_id);
    const canSpy: boolean = failureReasons.length === 0;
    const probeQuantities: Map<GameType.UnitType, number> = getEspionageProbeQuantities(context);
    const probesToSend: number = probeQuantities.get(GameType.UnitType.EspionageProbe) ?? 1;
    const variant: string = canSpy === true ? "color" : "gray";
    const spyTitle: string | undefined = canSpy === true ? `Send ${probesToSend} espionage probe(s)` : undefined;

    const handleSpyClick = async (): Promise<void> =>
    {
        if (canSpy === false)
        {
            return;
        }

        try
        {
            await ClientRequestFunctions.clientTrySendFleetRequest(context.psController, context.originPlanetData.planetRow.id, targetPlanetAddress, GameType.FleetActionType.Espionage, probeQuantities, NO_TRANSPORTED_RESOURCES);

            const targetAddressLabel: string = StaticDataHelper.formatPlanetAddress(targetPlanetAddress.galaxy, targetPlanetAddress.system, targetPlanetAddress.slot, targetPlanetAddress.zone);
            context.feedbackController.showSuccess(`${probesToSend} espionage probe(s) sent to ${targetAddressLabel}.`);
        }
        catch (error: unknown)
        {
            context.feedbackController.showError(ErrorHelp.getErrorMessage(error));
        }
    };

    const cursorClass: string = canSpy === true ? "cursor-pointer" : "cursor-default";

    const spyIcon: ReactElement =
    (
        <img
            src={`/icons/fleetAction/${GameType.FleetActionType.Espionage}_${variant}.png`}
            alt="Espionage"
            title={spyTitle}
            onClick={handleSpyClick}
            className={`w-4 h-4 object-contain ${cursorClass}`}
        />
    );

    return HelperElements.renderWithTooltip(failureReasons, spyIcon);
}

function renderPlanetRow(context: GalaxyViewContext, slot: number, selectedGalaxy: number, selectedSystem: number, publicPlanetDatas: CoreType.PublicPlanetData[], publicPlayerDatas: CoreType.PublicPlayerData[]): ReactElement
{
    const planetPublicPlanetData: CoreType.PublicPlanetData | null = CoreType.getPublicPlanetDataForAddress(publicPlanetDatas, { galaxy: selectedGalaxy, system: selectedSystem, slot: slot, zone: GameType.PlanetZone.Planet });
    const moonPublicPlanetData: CoreType.PublicPlanetData | null = CoreType.getPublicPlanetDataForAddress(publicPlanetDatas, { galaxy: selectedGalaxy, system: selectedSystem, slot: slot, zone: GameType.PlanetZone.Moon });
    const debrisPublicPlanetData: CoreType.PublicPlanetData | null = CoreType.getPublicPlanetDataForAddress(publicPlanetDatas, { galaxy: selectedGalaxy, system: selectedSystem, slot: slot, zone: GameType.PlanetZone.DebrisField });

    const hasMoon: boolean = moonPublicPlanetData !== null;

    const ownershipText: string = (planetPublicPlanetData === null)
        ? "Unowned"
        : `Owned by: ${getPlayerUsername(planetPublicPlanetData.owner_player_id, publicPlayerDatas)}`;

    const planetName: string = planetPublicPlanetData !== null ? StaticDataHelper.getPlanetDisplayName(planetPublicPlanetData) : "";

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
            <span className="w-32 truncate">{planetName}</span>
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

    const flooredDebrisResources: Map<GameType.ResourceType, number> = new Map<GameType.ResourceType, number>();
    for (const [resourceType, resourceQuantity] of debrisPublicPlanetData.dynamicPlanetData.resourceQuantity)
    {
        flooredDebrisResources.set(resourceType, Math.floor(resourceQuantity));
    }

    const debrisTooltipLines: string[] = HelperElements.buildCostParts(flooredDebrisResources);

    const debrisIcon: ReactElement =
    (
        <img src="/icons/zone/3_color.png" alt="Debris Field" className="w-4 h-4 object-contain" />
    );

    return HelperElements.renderWithTooltip(debrisTooltipLines, debrisIcon);
}

function renderPlanetGrid(context: GalaxyViewContext, selectedGalaxy: number, selectedSystem: number, playerData: CoreType.PlayerData): ReactElement
{
    const slotNumbers: number[] = Array.from({ length: StaticData.SLOT_COUNT }, (_: unknown, index: number): number => index + 1);

    const rowElements: ReactElement[] = slotNumbers.map((slot: number): ReactElement =>
    {
        return renderPlanetRow(context, slot, selectedGalaxy, selectedSystem, playerData.publicPlanetDatas, playerData.publicPlayerDatas);
    });

    const element: ReactElement =
    (
        <div className="flex flex-col gap-2">
            {rowElements}
        </div>
    );

    return element;
}

function renderBody(props: PlanetViewProps, originPlanetData: CoreType.PlanetData, feedbackController: HelperElements.ActionFeedbackController, selectedGalaxy: number, selectedSystem: number, handleGalaxyChange: (e: ChangeEvent<HTMLSelectElement>) => void, handleSystemChange: (e: ChangeEvent<HTMLSelectElement>) => void): ReactElement
{
    const playerData: CoreType.PlayerData = props.clientDataStateResult.psController[0].predictedDBData;

    const context: GalaxyViewContext =
    {
        playerData: playerData,
        originPlanetData: originPlanetData,
        serverData: props.clientDataStateResult.sdsController[0],
        psController: props.clientDataStateResult.psController,
        feedbackController: feedbackController,
    };

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
            {HelperElements.renderActionFeedback(feedbackController)}
        </div>
    );

    return element;
}

//#endregion

export function PlanetView(props: PlanetViewProps): ReactElement
{
    const selectedGalaxyState: [number, (value: number) => void] = useState<number>(1);
    const selectedSystemState: [number, (value: number) => void] = useState<number>(1);
    const feedbackController: HelperElements.ActionFeedbackController = HelperElements.useActionFeedback();
    const selectedPlanetId: number = props.clientDataStateResult.psController[0].selectedPlanetId;

    useEffect((): void =>
    {
        try
        {
            const planetDataPredicted: CoreType.PlanetData = SelectedPlanet.getSelectedPlanetDataPredicted(props.clientDataStateResult.psController[0]);
            selectedGalaxyState[1](planetDataPredicted.planetRow.galaxy);
            selectedSystemState[1](planetDataPredicted.planetRow.system);
            feedbackController.clearFeedback();
        }
        catch (error: unknown)
        {
            console.error("⚠️:", error);
        }
    }, [selectedPlanetId]);

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

    try
    {
        const planetDataPredicted: CoreType.PlanetData = SelectedPlanet.getSelectedPlanetDataPredicted(props.clientDataStateResult.psController[0]);
        return renderBody(props, planetDataPredicted, feedbackController, selectedGalaxyState[0], selectedSystemState[0], handleGalaxyChange, handleSystemChange);
    }
    catch (error: unknown)
    {
        console.error("⚠️:", error);
        return <HelperElements.EmptyElement />;
    }
}
