"use client";

import { ChangeEvent, ReactElement } from "react";

import * as TimeFormat from "@/lib/helper/timeFormat";
import * as UseClientDataState from "@/lib/use/useClientDataState";
import * as ClientRequestFunctions from "@/lib/networkRequests/client/clientRequestFunctions";
import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as DBType from "@/lib/db/dbTypes";
import * as UnitData from "@/lib/gameplay/dynamicData/planet/unitData";
import * as ThingHelpers from "@/lib/gameplay/coreData/thing/thingHelpers";
import * as ThingDataHelpers from "@/lib/gameplay/coreData/thing/thingDataHelpers";
import * as StaticDataHelper from "@/lib/gameplay/coreData/static/staticDataHelpers";
import * as Requirement from "@/lib/gameplay/coreData/requirement/requirements";
import * as RequirementType from "@/lib/gameplay/coreData/requirement/requirementTypes";
import * as HelperElement from "@/components/helpers/helperElements";
import * as UnitConstructionData from "@/lib/gameplay/dynamicData/planet/unitConstructionData";
import * as MissileSpaceData from "@/lib/gameplay/dynamicData/planet/missileSpaceData";
import * as UnitDescription from "@/lib/gameplay/coreData/description/unitDescriptions";

export type ComputeBuildableUnitQuantities = (planetData: CoreType.PlanetData, requestedUnitQuantities: Map<GameType.UnitType, number>) => Map<GameType.UnitType, number>;

export type RenderRowEndAction = (unitType: GameType.UnitType, requestedQuantity: number, planetData: CoreType.PlanetData) => ReactElement | null;

//#region pure helpers
export function buildSingleUnitCostParts(unitType: GameType.UnitType): string[]
{
    const singleCostMap: Map<GameType.ResourceType, number> | null = UnitConstructionData.getSingleUnitCost(unitType);
    if (singleCostMap === null)
    {
        return [];
    }

    return HelperElement.buildCostParts(singleCostMap);
}

export function buildRequestedUnitQuantitiesMap(unitTypes: GameType.UnitType[], requestedQuantities: Map<GameType.UnitType, number>): Map<GameType.UnitType, number>
{
    const requestedMap: Map<GameType.UnitType, number> = new Map<GameType.UnitType, number>();
    for (const unitType of unitTypes)
    {
        const requestedQuantity: number = requestedQuantities.get(unitType) ?? 0;
        if (requestedQuantity <= 0)
        {
            continue;
        }

        requestedMap.set(unitType, requestedQuantity);
    }

    return requestedMap;
}
//#endregion

//#region build rows
function renderBuildQuantityInput(playerData: CoreType.PlayerData, planetData: CoreType.PlanetData, unitType: GameType.UnitType, requestedQuantity: number, setRequestedQuantity: (unitType: GameType.UnitType, value: number) => void): ReactElement
{
    const planetId: number = planetData.planetRow.id;

    const requirementContext: RequirementType.RequirementContext =
    {
        playerData: playerData,
        planetId: planetId,
    };
    const failedUnitRequirements: RequirementType.Requirement[] = Requirement.getFailedUnitBuildRequirements(requirementContext, unitType);
    if (failedUnitRequirements.length > 0)
    {
        const requirements: string[] = Requirement.getRequirementDescriptions(failedUnitRequirements, requirementContext);

        const disabledQuantityInput: ReactElement =
        (
            <input
                type="number"
                value={0}
                readOnly
                disabled
                className="border border-gray-400 px-2 py-1 rounded bg-white text-black w-24 disabled:bg-gray-400 disabled:cursor-not-allowed"
            />
        );

        return HelperElement.renderWithTooltip(requirements, disabledQuantityInput);
    }

    const remainingBuildableCount: number | null = Requirement.getRemainingBuildableUnitCount(requirementContext, unitType);

    const handleQuantityChange = (e: ChangeEvent<HTMLInputElement>): void =>
    {
        const parsedValue: number = Number.parseInt(e.target.value, 10);

        if (Number.isNaN(parsedValue) || parsedValue < 0)
        {
            setRequestedQuantity(unitType, 0);
            return;
        }

        const cappedValue: number = remainingBuildableCount === null ? parsedValue : Math.min(parsedValue, remainingBuildableCount);
        setRequestedQuantity(unitType, cappedValue);
    };

    const element: ReactElement =
    (
        <input
            type="number"
            min={0}
            max={remainingBuildableCount ?? undefined}
            value={requestedQuantity}
            onChange={handleQuantityChange}
            className="border border-gray-400 px-2 py-1 rounded bg-white text-black w-24"
        />
    );

    return element;
}

function renderUnitCostLines(costParts: string[]): ReactElement
{
    const costPartElements: ReactElement[] = [];

    for (const costPart of costParts)
    {
        costPartElements.push(
            <div key={costPart} className="pl-4">{costPart}</div>
        );
    }

    const element: ReactElement =
    (
        <div className="text-xs">
            <div>Cost:</div>
            {costPartElements}
        </div>
    );

    return element;
}

function renderUnitBuildRow(playerData: CoreType.PlayerData, planetData: CoreType.PlanetData, serverData: CoreType.ServerData, unitType: GameType.UnitType, requestedQuantity: number, setRequestedQuantity: (unitType: GameType.UnitType, value: number) => void, renderRowEndAction: RenderRowEndAction | undefined): ReactElement
{
    const unitName: string = ThingDataHelpers.getSpecificThingName(ThingHelpers.unit(unitType));
    const unitImageElement: ReactElement = HelperElement.renderUnitImage(unitType);
    const unitDescriptionLines: string[] = UnitDescription.getUnitDescriptionLines(unitType);
    const ownedQuantity: number = UnitData.getUnitQuantity(planetData, unitType);
    const singleDurationSeconds: number = UnitConstructionData.getUnitConstructionDurationSeconds(unitType, planetData, serverData) ?? 0;
    const costParts: string[] = buildSingleUnitCostParts(unitType);
    const costElement: ReactElement = renderUnitCostLines(costParts);
    const missileSpaceCost: number = MissileSpaceData.getUnitMissileSpaceCost(unitType);

    const spaceLine: ReactElement | null = missileSpaceCost > 0
        ? <div className="text-xs">Space: {missileSpaceCost}</div>
        : null;

    const rowEndAction: ReactElement | null = renderRowEndAction === undefined ? null : renderRowEndAction(unitType, requestedQuantity, planetData);
    const rowEndCell: ReactElement | null = rowEndAction === null
        ? null
        : (
            <div className="flex items-center justify-center px-4 py-3 border-l border-gray-400 min-w-[120px]">
                {rowEndAction}
            </div>
        );

    const element: ReactElement =
    (
        <div key={unitType} className="flex flex-row items-center border border-gray-400 rounded">
            <div className="flex items-center justify-center px-4 py-3 border-r border-gray-400">
                {HelperElement.renderWithTooltip(unitDescriptionLines, unitImageElement, "below")}
            </div>

            <div className="flex flex-col px-4 py-3 border-r border-gray-400 min-w-[200px]">
                <div className="font-bold">{unitName}</div>
                <div className="text-xs">Time: {TimeFormat.formatRemainingTimeMs(singleDurationSeconds * 1000)}</div>
                {costElement}
                {spaceLine}
            </div>

            <div className="flex items-center justify-center px-4 py-3 border-r border-gray-400 min-w-[100px]">
                <div className="text-sm">{ownedQuantity} owned</div>
            </div>

            <div className="flex items-center justify-center px-4 py-3 min-w-[140px]">
                {renderBuildQuantityInput(playerData, planetData, unitType, requestedQuantity, setRequestedQuantity)}
            </div>

            {rowEndCell}
        </div>
    );

    return element;
}

function groupUnitTypesByCategory(unitTypes: GameType.UnitType[]): Map<GameType.UnitCategory, GameType.UnitType[]>
{
    const unitTypesByCategory: Map<GameType.UnitCategory, GameType.UnitType[]> = new Map<GameType.UnitCategory, GameType.UnitType[]>();
    for (const unitType of unitTypes)
    {
        const unitCategory: GameType.UnitCategory = StaticDataHelper.getUnitCategory(unitType);
        let categoryUnitTypes: GameType.UnitType[] | undefined = unitTypesByCategory.get(unitCategory);
        if (categoryUnitTypes === undefined)
        {
            categoryUnitTypes = [];
            unitTypesByCategory.set(unitCategory, categoryUnitTypes);
        }

        categoryUnitTypes.push(unitType);
    }

    return unitTypesByCategory;
}

function renderUnitBuildSection(playerData: CoreType.PlayerData, unitCategory: GameType.UnitCategory, categoryUnitTypes: GameType.UnitType[], planetData: CoreType.PlanetData, serverData: CoreType.ServerData, requestedQuantities: Map<GameType.UnitType, number>, setRequestedQuantity: (unitType: GameType.UnitType, value: number) => void, renderRowEndAction: RenderRowEndAction | undefined): ReactElement
{
    const categoryName: string = StaticDataHelper.getUnitCategoryDisplayName(unitCategory);

    const rowElements: ReactElement[] = categoryUnitTypes.map((unitType: GameType.UnitType) =>
    {
        const requestedQuantity: number = requestedQuantities.get(unitType) ?? 0;
        return renderUnitBuildRow(playerData, planetData, serverData, unitType, requestedQuantity, setRequestedQuantity, renderRowEndAction);
    });

    const element: ReactElement =
    (
        <div key={unitCategory} className="flex flex-col gap-2">
            <div className="text-base font-bold text-white">{categoryName}</div>
            {rowElements}
        </div>
    );

    return element;
}

export function renderUnitBuildSections(playerData: CoreType.PlayerData, unitTypes: GameType.UnitType[], planetData: CoreType.PlanetData, serverData: CoreType.ServerData, requestedQuantities: Map<GameType.UnitType, number>, setRequestedQuantity: (unitType: GameType.UnitType, value: number) => void, renderRowEndAction?: RenderRowEndAction): ReactElement
{
    const unitTypesByCategory: Map<GameType.UnitCategory, GameType.UnitType[]> = groupUnitTypesByCategory(unitTypes);
    const sectionElements: ReactElement[] = [...unitTypesByCategory].map(([unitCategory, categoryUnitTypes]: [GameType.UnitCategory, GameType.UnitType[]]) =>
    {
        return renderUnitBuildSection(playerData, unitCategory, categoryUnitTypes, planetData, serverData, requestedQuantities, setRequestedQuantity, renderRowEndAction);
    });

    const element: ReactElement =
    (
        <div className="flex flex-col gap-4 text-sm font-semibold text-white whitespace-nowrap inline-block">
            {sectionElements}
        </div>
    );

    return element;
}
//#endregion

//#region build preview + button
function renderBuildableUnitLines(buildableQuantities: Map<GameType.UnitType, number>): ReactElement[]
{
    const unitLineElements: ReactElement[] = [];
    for (const [unitType, unitQuantity] of buildableQuantities)
    {
        if (unitQuantity <= 0)
        {
            continue;
        }

        unitLineElements.push(
            <div key={unitType} className="text-sm">
                {ThingDataHelpers.getSpecificThingName(ThingHelpers.unit(unitType))} x {unitQuantity}
            </div>
        );
    }

    return unitLineElements;
}

function renderBuildableResourceLines(totalCost: Map<GameType.ResourceType, number>): ReactElement[]
{
    const resourceLineElements: ReactElement[] = [];
    for (const [resourceType, resourceCost] of totalCost)
    {
        resourceLineElements.push(
            <div key={resourceType} className="text-sm text-blue-400">
                {resourceCost} {ThingDataHelpers.getSpecificThingName(ThingHelpers.resource(resourceType))}
            </div>
        );
    }

    return resourceLineElements;
}

export function renderBuildPreviewContent(planetData: CoreType.PlanetData, serverData: CoreType.ServerData, requestedMap: Map<GameType.UnitType, number>, computeBuildable: ComputeBuildableUnitQuantities, insufficientText: string): ReactElement | null
{
    if (requestedMap.size === 0)
    {
        return null;
    }

    const buildableQuantities: Map<GameType.UnitType, number> = computeBuildable(planetData, requestedMap);
    if (buildableQuantities.size === 0)
    {
        const insufficientElement: ReactElement =
        (
            <div className="border border-gray-400 rounded px-6 py-4 text-center w-80">
                {insufficientText}
            </div>
        );

        return insufficientElement;
    }

    const totalDurationSeconds: number = UnitConstructionData.computeUnitQuantitiesConstructionDurationSeconds(buildableQuantities, planetData, serverData);
    const totalCost: Map<GameType.ResourceType, number> = UnitConstructionData.computeUnitConstructionCost(buildableQuantities);

    const element: ReactElement =
    (
        <div className="border border-gray-400 rounded px-6 py-4 flex flex-col items-center gap-2 w-80 bg-black">
            <div className="flex flex-col items-center gap-1">
                {renderBuildableUnitLines(buildableQuantities)}
            </div>

            <div className="flex flex-col items-center gap-1">
                {renderBuildableResourceLines(totalCost)}
            </div>

            <div className="text-sm font-semibold">
                Total time: {TimeFormat.formatRemainingTimeMs(totalDurationSeconds * 1000)}
            </div>
        </div>
    );

    return element;
}

export function renderBuildButton(planetData: CoreType.PlanetData, requestedMap: Map<GameType.UnitType, number>, hasRequestedData: boolean, onBuildAll: () => void, computeBuildable: ComputeBuildableUnitQuantities, insufficientText: string): ReactElement | null
{
    if (hasRequestedData === false)
    {
        return null;
    }

    const buildableQuantities: Map<GameType.UnitType, number> = computeBuildable(planetData, requestedMap);
    const isBuildDisabled: boolean = buildableQuantities.size === 0;

    const buildButton: ReactElement =
    (
        <button
            onClick={onBuildAll}
            disabled={isBuildDisabled}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
            Build all
        </button>
    );

    const buildDisabledReasons: string[] = isBuildDisabled === true ? [insufficientText] : [];

    return HelperElement.renderWithTooltip(buildDisabledReasons, buildButton);
}

export function createBuildUnitsHandler(clientDataStateResult: UseClientDataState.ClientDataStateResult, planetData: CoreType.PlanetData, requestedQuantities: Map<GameType.UnitType, number>, resetRequestedQuantities: () => void): () => void
{
    return () =>
    {
        ClientRequestFunctions.clientTryBuildUnitsRequest(clientDataStateResult.psController, planetData.planetRow.id, requestedQuantities);
        resetRequestedQuantities();
    };
}
//#endregion

//#region construction-in-progress section
function renderActiveConstructionHeader(unitConstruction: CoreType.UnitConstruction): ReactElement | null
{
    const currentUnitRow: DBType.UnitConstructionUnitRow | undefined = unitConstruction.unitConstructionUnitRows.find(
        (row: DBType.UnitConstructionUnitRow): boolean => row.id === unitConstruction.unitConstructionRow.current_unit_construction_unit_row_id
    );

    if (currentUnitRow === undefined)
    {
        return null;
    }

    const currentUnitName: string = ThingDataHelpers.getSpecificThingName(ThingHelpers.unit(currentUnitRow.unit_type));

    const element: ReactElement =
    (
        <div className="text-xs font-semibold text-yellow-400">Building: {currentUnitName}</div>
    );

    return element;
}

function renderTimer(isActive: boolean, remainingMs: number, durationAtRequestTimeMs: number): ReactElement
{
    if (isActive === true)
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
        <div className="flex flex-col items-center text-xs text-gray-400 text-center">
            <div>Total at request:</div>
            <div>{TimeFormat.formatRemainingTimeMs(durationAtRequestTimeMs)}</div>
        </div>
    );

    return idleElement;
}

function renderUnitLines(planetData: CoreType.PlanetData, unitConstruction: CoreType.UnitConstruction, serverData: CoreType.ServerData): ReactElement[]
{
    UnitConstructionData.sortUnitConstructionUnitRowByConstructionTime(planetData, unitConstruction, serverData);
    const lineElements: ReactElement[] = [];

    for (const unitRow of unitConstruction.unitConstructionUnitRows)
    {
        const unitName: string = ThingDataHelpers.getSpecificThingName(ThingHelpers.unit(unitRow.unit_type));

        lineElements.push(
            <div key={unitRow.unit_type} className="text-sm">
                {unitName} x {unitRow.unit_quantity}
            </div>
        );
    }

    return lineElements;
}

function renderConstructionRow(planetData: CoreType.PlanetData, unitConstruction: CoreType.UnitConstruction, serverData: CoreType.ServerData, isActive: boolean, remainingMs: number): ReactElement
{
    const headerElement: ReactElement | null = isActive === true ? renderActiveConstructionHeader(unitConstruction) : null;
    const timerElement: ReactElement = renderTimer(isActive, remainingMs, unitConstruction.unitConstructionRow.duration_at_request_time);

    const element: ReactElement =
    (
        <div key={unitConstruction.unitConstructionRow.id} className="flex flex-row border border-gray-400 rounded w-full h-24">
            <div className="flex flex-col gap-1 px-6 py-3 border-r border-gray-400 flex-1 min-w-[160px] overflow-y-auto">
                {headerElement}
                {renderUnitLines(planetData, unitConstruction, serverData)}
            </div>
            <div className="flex items-center justify-center px-6 py-3 w-[140px] shrink-0">
                {timerElement}
            </div>
        </div>
    );

    return element;
}

export function renderUnitConstructionSection(planetData: CoreType.PlanetData, serverData: CoreType.ServerData, queueType: GameType.UnitConstructionQueueType, emptyText: string): ReactElement
{
    const queuedConstructions: CoreType.UnitConstruction[] = planetData.dynamicPlanetData.unitConstructions.filter((unitConstruction: CoreType.UnitConstruction): boolean =>
    {
        return UnitConstructionData.getUnitConstructionQueueType(unitConstruction) === queueType;
    });

    if (queuedConstructions.length === 0)
    {
        const emptyElement: ReactElement =
        (
            <div className="border border-gray-400 rounded px-6 py-4 text-sm text-center w-full">
                {emptyText}
            </div>
        );

        return emptyElement;
    }

    const sortedConstructions: CoreType.UnitConstruction[] = [...queuedConstructions].sort(
        (a: CoreType.UnitConstruction, b: CoreType.UnitConstruction): number =>
        {
            const aIsStarted: boolean = a.unitConstructionRow.started_at !== null;
            const bIsStarted: boolean = b.unitConstructionRow.started_at !== null;

            if (aIsStarted === true && bIsStarted === false)
            {
                return -1;
            }

            if (aIsStarted === false && bIsStarted === true)
            {
                return 1;
            }

            return 0;
        }
    );

    const remainingMs: number = UnitConstructionData.getUnitConstructionRemainingMs(planetData, queueType) ?? 0;

    const rowElements: ReactElement[] = sortedConstructions.map((unitConstruction: CoreType.UnitConstruction, index: number): ReactElement =>
    {
        const isActive: boolean = index === 0 && unitConstruction.unitConstructionRow.started_at !== null;
        return renderConstructionRow(planetData, unitConstruction, serverData, isActive, remainingMs);
    });

    const element: ReactElement =
    (
        <div className="flex flex-col gap-2 w-full">
            {rowElements}
        </div>
    );

    return element;
}
//#endregion
