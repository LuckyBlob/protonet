"use client";

import { useEffect, useState, ChangeEvent, ReactElement } from "react";

import * as ErrorHelp from "@/lib/helper/errorHelp";
import * as SelectedPlanet from "@/lib/localStorage/selectedPlanet";
import * as UseClientDataState from "@/lib/use/useClientDataState";
import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as UnitData from "@/lib/gameplay/dynamicData/planet/unitData";
import * as ResearchData from "@/lib/gameplay/dynamicData/player/researchData";
import * as HelperElements from "@/components/helpers/helperElements";
import * as FleetMovementElements from "@/components/helpers/fleetMovementElements";
import * as ThingHelpers from "@/lib/gameplay/coreData/thing/thingHelpers";
import * as ThingDataHelpers from "@/lib/gameplay/coreData/thing/thingDataHelpers";
import * as StaticDataHelper from "@/lib/gameplay/coreData/static/staticDataHelpers";
import * as FleetRange from "@/lib/gameplay/coreData/formula/fleetRangeFormulas";
import * as FleetDuration from "@/lib/gameplay/coreData/formula/fleetMovementDurationFormulas";
import * as Requirement from "@/lib/gameplay/coreData/requirement/requirements";
import * as RequirementType from "@/lib/gameplay/coreData/requirement/requirementTypes";
import * as ClientRequestFunctions from "@/lib/networkRequests/client/clientRequestFunctions";

type MissileFleetViewProps =
{
    clientDataStateResult: UseClientDataState.ClientDataStateResult;
};

const LAUNCHABLE_MISSILE_TYPE: GameType.UnitType = GameType.UnitType.InterplanetaryMissile;
const TARGETABLE_ZONES: GameType.PlanetZone[] = [GameType.PlanetZone.Planet, GameType.PlanetZone.Moon];

type MissileLaunchData =
{
    playerData: CoreType.PlayerData;
    publicPlanetDatas: CoreType.PublicPlanetData[];
    serverData: CoreType.ServerData;
    originPlanetData: CoreType.PlanetData;
    targetAddress: GameType.PlanetAddress;
    requestedQuantity: number;
    setRequestedQuantity: (unitType: GameType.UnitType, value: number) => void;
    galaxyState: [number, (value: number) => void];
    systemState: [number, (value: number) => void];
    slotState: [number, (value: number) => void];
    zoneState: [GameType.PlanetZone, (value: GameType.PlanetZone) => void];
    unitFocusState: [GameType.UnitType | null, (value: GameType.UnitType | null) => void];
    feedbackController: HelperElements.ActionFeedbackController;
};

function getTargetAddress(galaxy: number, system: number, slot: number, zone: GameType.PlanetZone): GameType.PlanetAddress
{
    const targetAddress: GameType.PlanetAddress =
    {
        galaxy: galaxy,
        system: system,
        slot: slot,
        zone: zone,
    };

    return targetAddress;
}

function formatFlightTime(totalSeconds: number): string
{
    const minutes: number = Math.floor(totalSeconds / 60);
    const seconds: number = totalSeconds % 60;
    if (minutes === 0)
    {
        return `${seconds}s`;
    }

    return `${minutes}m ${seconds}s`;
}

function renderCoordinateInput(label: string, value: number, onChange: (e: ChangeEvent<HTMLInputElement>) => void): ReactElement
{
    const element: ReactElement =
    (
        <label className="flex flex-col items-center text-xs text-gray-300 gap-1">
            {label}
            <input
                type="number"
                min={1}
                value={value}
                onChange={onChange}
                className="w-16 bg-black border border-gray-500 rounded text-center text-sm py-1"
            />
        </label>
    );

    return element;
}

function renderTargetInputs(data: MissileLaunchData): ReactElement
{
    const handleGalaxyChange = (e: ChangeEvent<HTMLInputElement>): void =>
    {
        data.galaxyState[1](Math.max(1, Number.parseInt(e.target.value, 10) || 1));
    };

    const handleSystemChange = (e: ChangeEvent<HTMLInputElement>): void =>
    {
        data.systemState[1](Math.max(1, Number.parseInt(e.target.value, 10) || 1));
    };

    const handleSlotChange = (e: ChangeEvent<HTMLInputElement>): void =>
    {
        data.slotState[1](Math.max(1, Number.parseInt(e.target.value, 10) || 1));
    };

    const handleZoneChange = (e: ChangeEvent<HTMLSelectElement>): void =>
    {
        data.zoneState[1](Number.parseInt(e.target.value, 10) as GameType.PlanetZone);
    };

    const zoneOptionElements: ReactElement[] = TARGETABLE_ZONES.map((zone: GameType.PlanetZone): ReactElement =>
    {
        const zoneInfo: GameType.PlanetZoneInfo = StaticDataHelper.getPlanetZoneInfo(zone);
        return <option key={zone} value={zone}>{zoneInfo.displayName}</option>;
    });

    const element: ReactElement =
    (
        <div className="flex flex-row items-end gap-3 justify-center">
            {renderCoordinateInput("Galaxy", data.galaxyState[0], handleGalaxyChange)}
            {renderCoordinateInput("System", data.systemState[0], handleSystemChange)}
            {renderCoordinateInput("Slot", data.slotState[0], handleSlotChange)}
            <label className="flex flex-col items-center text-xs text-gray-300 gap-1">
                Zone
                <select value={data.zoneState[0]} onChange={handleZoneChange} className="bg-black border border-gray-500 rounded text-sm py-1">
                    {zoneOptionElements}
                </select>
            </label>
        </div>
    );

    return element;
}

function renderFocusSelect(data: MissileLaunchData): ReactElement
{
    const defenseUnitTypes: GameType.UnitType[] = StaticDataHelper.getUnitsByCategory(GameType.UnitCategory.Defense);

    const handleFocusChange = (e: ChangeEvent<HTMLSelectElement>): void =>
    {
        const rawValue: string = e.target.value;
        if (rawValue === "")
        {
            data.unitFocusState[1](null);
            return;
        }

        data.unitFocusState[1](Number.parseInt(rawValue, 10) as GameType.UnitType);
    };

    const focusOptionElements: ReactElement[] = defenseUnitTypes.map((unitType: GameType.UnitType): ReactElement =>
    {
        const unitName: string = ThingDataHelpers.getSpecificThingName(ThingHelpers.unit(unitType));
        return <option key={unitType} value={unitType}>{unitName}</option>;
    });

    const selectedValue: string = data.unitFocusState[0] === null ? "" : String(data.unitFocusState[0]);

    const element: ReactElement =
    (
        <label className="flex flex-col items-center text-xs text-gray-300 gap-1">
            Preferred defense to hit
            <select value={selectedValue} onChange={handleFocusChange} className="bg-black border border-gray-500 rounded text-sm py-1 min-w-[160px]">
                <option value="">Any defense</option>
                {focusOptionElements}
            </select>
        </label>
    );

    return element;
}

function renderRangeReadout(data: MissileLaunchData): ReactElement
{
    const impulseDriveLevel: number = ResearchData.getResearchLevel(data.playerData, GameType.ResearchType.ImpulseDrive);
    const rangeSystems: number = FleetRange.computeMissileRangeSystems(impulseDriveLevel);
    const originAddress: GameType.PlanetAddress = CoreType.getPlanetAddress(data.originPlanetData);
    const isWithinRange: boolean = FleetRange.isTargetWithinMissileRange(originAddress, data.targetAddress, impulseDriveLevel);
    const flightSeconds: number = FleetDuration.computeFleetMovementDurationSecondsWithAddress(data.playerData, originAddress, data.targetAddress, new Map<GameType.UnitType, number>([[LAUNCHABLE_MISSILE_TYPE, 1]]), data.serverData);

    const rangeColorClass: string = isWithinRange === true ? "text-green-400" : "text-red-400";

    const element: ReactElement =
    (
        <div className="flex flex-col items-center text-xs gap-1">
            <div className="text-gray-300">Range: {rangeSystems} systems (Impulse Drive {impulseDriveLevel})</div>
            <div className={rangeColorClass}>{isWithinRange === true ? `In range — flight time ${formatFlightTime(flightSeconds)}` : "Target out of range"}</div>
        </div>
    );

    return element;
}

function renderLaunchControls(props: MissileFleetViewProps, data: MissileLaunchData): ReactElement
{
    const ownedQuantity: number = UnitData.getUnitQuantity(data.originPlanetData, LAUNCHABLE_MISSILE_TYPE);
    const cappedRequestedQuantity: number = Math.min(data.requestedQuantity, ownedQuantity);

    const targetPublicPlanetData: CoreType.PublicPlanetData | null = CoreType.getPublicPlanetDataForAddress(data.publicPlanetDatas, data.targetAddress);
    const zoneAssociatedPlanetAddress: GameType.PlanetAddress = { ...data.targetAddress, zone: GameType.PlanetZone.Planet };
    const zoneAssociatedPlanetData: CoreType.PublicPlanetData | null = CoreType.getPublicPlanetDataForAddress(data.publicPlanetDatas, zoneAssociatedPlanetAddress);

    const requirementContext: RequirementType.RequirementContext =
    {
        playerData: data.playerData,
        planetId: data.originPlanetData.planetRow.id,
        unitQuantities: new Map<GameType.UnitType, number>([[LAUNCHABLE_MISSILE_TYPE, data.requestedQuantity]]),
        transportedResourceQuantities: new Map<GameType.ResourceType, number>(),
        targetPlanetAddress: data.targetAddress,
        zoneAssociatedPlanetOwnerPlayerId: zoneAssociatedPlanetData?.owner_player_id ?? null,
        targetZoneExists: targetPublicPlanetData !== null,
    };

    const failedRequirements: RequirementType.Requirement[] = Requirement.getFailedFleetMovementRequirements(requirementContext, GameType.FleetActionType.MissileLaunch);
    const isLaunchDisabled: boolean = (cappedRequestedQuantity === 0) || (failedRequirements.length > 0);

    const feedbackController: HelperElements.ActionFeedbackController = data.feedbackController;
    const handleLaunch = async (): Promise<void> =>
    {
        const unitQuantities: Map<GameType.UnitType, number> = new Map<GameType.UnitType, number>([[LAUNCHABLE_MISSILE_TYPE, cappedRequestedQuantity]]);

        try
        {
            await ClientRequestFunctions.clientTrySendFleetRequest(
                props.clientDataStateResult.psController,
                data.originPlanetData.planetRow.id,
                data.targetAddress,
                GameType.FleetActionType.MissileLaunch,
                unitQuantities,
                new Map<GameType.ResourceType, number>(),
                undefined,
                data.unitFocusState[0]);
        }
        catch (error: unknown)
        {
            feedbackController.showError(ErrorHelp.getErrorMessage(error));
        }
    };

    const errorElement: ReactElement = HelperElements.renderActionFeedback(feedbackController);

    const buttonClass: string = isLaunchDisabled === true
        ? "bg-gray-700 text-gray-400 cursor-not-allowed"
        : "bg-red-700 hover:bg-red-600 text-white";

    const launchDisabledReasons: string[] = [];
    if (cappedRequestedQuantity === 0)
    {
        launchDisabledReasons.push("Select at least one missile to launch.");
    }

    launchDisabledReasons.push(...Requirement.getRequirementDescriptions(failedRequirements, requirementContext));

    const launchButton: ReactElement =
    (
        <button type="button" disabled={isLaunchDisabled} onClick={handleLaunch} className={`rounded px-6 py-2 text-sm font-bold ${buttonClass}`}>
            Launch missiles
        </button>
    );

    const element: ReactElement =
    (
        <div className="flex flex-col items-center gap-2">
            <label className="flex flex-col items-center text-xs text-gray-300 gap-1">
                Missiles to launch ({ownedQuantity} owned)
                {HelperElements.renderQuantityInput(LAUNCHABLE_MISSILE_TYPE, 0, ownedQuantity, cappedRequestedQuantity, data.originPlanetData, data.setRequestedQuantity)}
            </label>
            {HelperElements.renderWithTooltip(launchDisabledReasons, launchButton)}
            {errorElement}
        </div>
    );

    return element;
}

function renderMissileFleetBody(props: MissileFleetViewProps, data: MissileLaunchData): ReactElement
{
    const element: ReactElement =
    (
        <div className="w-full flex flex-col items-center pt-4">
            <div className="flex flex-row items-start justify-center">
                <div className="flex flex-col items-center gap-6 px-6">
                    <div className="flex flex-col items-center gap-1">
                        {HelperElements.renderUnitImage(LAUNCHABLE_MISSILE_TYPE)}
                        <div className="font-bold text-base">{ThingDataHelpers.getSpecificThingName(ThingHelpers.unit(LAUNCHABLE_MISSILE_TYPE))}</div>
                    </div>

                    {renderTargetInputs(data)}
                    {renderFocusSelect(data)}
                    {renderRangeReadout(data)}
                    {renderLaunchControls(props, data)}
                </div>

                <div className="w-px bg-gray-400 h-80 my-0" />

                <div className="flex flex-col items-center gap-2 px-6">
                    {FleetMovementElements.renderFleetMovementsSection(props.clientDataStateResult, GameType.FleetActionCategory.Missile, data.feedbackController)}
                </div>
            </div>
        </div>
    );

    return element;
}

export function MissileFleetView(props: MissileFleetViewProps): ReactElement
{
    const quantitiesState: HelperElements.RequestedQuantitiesState<GameType.UnitType> = HelperElements.useRequestedQuantities<GameType.UnitType>();
    const galaxyState: [number, (value: number) => void] = useState<number>(1);
    const systemState: [number, (value: number) => void] = useState<number>(1);
    const slotState: [number, (value: number) => void] = useState<number>(1);
    const zoneState: [GameType.PlanetZone, (value: GameType.PlanetZone) => void] = useState<GameType.PlanetZone>(GameType.PlanetZone.Planet);
    const unitFocusState: [GameType.UnitType | null, (value: GameType.UnitType | null) => void] = useState<GameType.UnitType | null>(null);
    const feedbackController: HelperElements.ActionFeedbackController = HelperElements.useActionFeedback();
    const selectedPlanetId: number = props.clientDataStateResult.psController[0].selectedPlanetId;

    useEffect((): void =>
    {
        quantitiesState.resetRequestedQuantities();
    }, [selectedPlanetId]);

    try
    {
        const selectedPlanetDataPredicted: CoreType.PlanetData = SelectedPlanet.getSelectedPlanetDataPredicted(props.clientDataStateResult.psController[0]);
        const requestedQuantity: number = quantitiesState.requestedQuantities.get(LAUNCHABLE_MISSILE_TYPE) ?? 0;

        const data: MissileLaunchData =
        {
            playerData: props.clientDataStateResult.psController[0].predictedDBData,
            publicPlanetDatas: props.clientDataStateResult.psController[0].dbData.publicPlanetDatas,
            serverData: props.clientDataStateResult.sdsController[0],
            originPlanetData: selectedPlanetDataPredicted,
            targetAddress: getTargetAddress(galaxyState[0], systemState[0], slotState[0], zoneState[0]),
            requestedQuantity: requestedQuantity,
            setRequestedQuantity: quantitiesState.setRequestedQuantity,
            galaxyState: galaxyState,
            systemState: systemState,
            slotState: slotState,
            zoneState: zoneState,
            unitFocusState: unitFocusState,
            feedbackController: feedbackController,
        };

        return renderMissileFleetBody(props, data);
    }
    catch (error: unknown)
    {
        console.error("⚠️:", error);
        return <HelperElements.EmptyElement />;
    }
}
