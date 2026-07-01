import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as DBType from "@/lib/db/dbTypes";
import * as BuildingData from "@/lib/gameplay/dynamicData/planet/buildingData";
import * as UnitConstructionData from "@/lib/gameplay/dynamicData/planet/unitConstructionData";

const REPAIR_DURATION_FLOOR_MS: number = 30 * 60 * 1000;
const REPAIR_DURATION_CAP_MS: number = 12 * 60 * 60 * 1000;
const REPAIR_BURN_UP_MS: number = 72 * 60 * 60 * 1000;
const REPAIR_AUTO_COLLECT_MS: number = 72 * 60 * 60 * 1000;

export function getPendingRepairForId(planetData: CoreType.PlanetData, pendingRepairId: number): CoreType.PendingRepair | null
{
    const matchingPendingRepair: CoreType.PendingRepair | undefined = planetData.dynamicPlanetData.pendingRepairs.find((pendingRepair: CoreType.PendingRepair): boolean =>
    {
        return pendingRepair.pendingRepairRow.id === pendingRepairId;
    });

    return matchingPendingRepair ?? null;
}

export function getPendingRepairUnitQuantities(pendingRepair: CoreType.PendingRepair): Map<GameType.UnitType, number>
{
    const unitQuantities: Map<GameType.UnitType, number> = new Map<GameType.UnitType, number>();
    for (const pendingRepairUnitRow of pendingRepair.pendingRepairUnitRows)
    {
        unitQuantities.set(pendingRepairUnitRow.unit_type as GameType.UnitType, pendingRepairUnitRow.unit_quantity);
    }

    return unitQuantities;
}

export function getRepairDockLevel(planetData: CoreType.PlanetData): number
{
    return BuildingData.getBuildingLevel(planetData, GameType.BuildingType.RepairDock);
}

export function isWreckAwaitingRepair(pendingRepair: CoreType.PendingRepair): boolean
{
    return pendingRepair.pendingRepairRow.repair_started_at === null;
}

export function isRepairing(pendingRepair: CoreType.PendingRepair, now: number): boolean
{
    const pendingRepairRow: DBType.PendingRepairRow = pendingRepair.pendingRepairRow;
    return pendingRepairRow.repair_started_at !== null && pendingRepairRow.repair_completes_at !== null && now < pendingRepairRow.repair_completes_at;
}

export function isRepairReady(pendingRepair: CoreType.PendingRepair, now: number): boolean
{
    const pendingRepairRow: DBType.PendingRepairRow = pendingRepair.pendingRepairRow;
    return pendingRepairRow.repair_started_at !== null && pendingRepairRow.repair_completes_at !== null && now >= pendingRepairRow.repair_completes_at;
}

export function isAnyRepairInProgress(planetData: CoreType.PlanetData, now: number): boolean
{
    return planetData.dynamicPlanetData.pendingRepairs.some((pendingRepair: CoreType.PendingRepair): boolean =>
    {
        return isRepairing(pendingRepair, now);
    });
}

export function canStartRepair(planetData: CoreType.PlanetData, pendingRepair: CoreType.PendingRepair, now: number): boolean
{
    if (getRepairDockLevel(planetData) < 1)
    {
        return false;
    }

    if (isWreckAwaitingRepair(pendingRepair) === false)
    {
        return false;
    }

    return isAnyRepairInProgress(planetData, now) === false;
}

export function canCollectRepair(pendingRepair: CoreType.PendingRepair, now: number): boolean
{
    return isRepairReady(pendingRepair, now);
}

export function canBurnWreckField(planetData: CoreType.PlanetData, now: number): boolean
{
    return isAnyRepairInProgress(planetData, now) === false;
}

export function computeRepairDurationMs(pendingRepair: CoreType.PendingRepair, planetData: CoreType.PlanetData, serverData: CoreType.ServerData): number
{
    const unitQuantities: Map<GameType.UnitType, number> = getPendingRepairUnitQuantities(pendingRepair);
    const rawDurationMs: number = UnitConstructionData.computeUnitQuantitiesConstructionDurationSeconds(unitQuantities, planetData, serverData) * 1000;
    return Math.min(REPAIR_DURATION_CAP_MS, Math.max(REPAIR_DURATION_FLOOR_MS, rawDurationMs));
}

export function getRepairRemainingMs(pendingRepair: CoreType.PendingRepair, now: number): number | null
{
    const pendingRepairRow: DBType.PendingRepairRow = pendingRepair.pendingRepairRow;
    if (pendingRepairRow.repair_completes_at === null)
    {
        return null;
    }

    return pendingRepairRow.repair_completes_at - now;
}

export function getBurnUpTime(pendingRepair: CoreType.PendingRepair): number | null
{
    if (isWreckAwaitingRepair(pendingRepair) === false)
    {
        return null;
    }

    return pendingRepair.pendingRepairRow.created_at + REPAIR_BURN_UP_MS;
}

export function getAutoCollectTime(pendingRepair: CoreType.PendingRepair): number | null
{
    const pendingRepairRow: DBType.PendingRepairRow = pendingRepair.pendingRepairRow;
    if (pendingRepairRow.repair_started_at === null || pendingRepairRow.repair_completes_at === null)
    {
        return null;
    }

    return pendingRepairRow.repair_completes_at + REPAIR_AUTO_COLLECT_MS;
}

export function startRepair(pendingRepair: CoreType.PendingRepair, planetData: CoreType.PlanetData, serverData: CoreType.ServerData, now: number): void
{
    const repairDurationMs: number = computeRepairDurationMs(pendingRepair, planetData, serverData);
    pendingRepair.pendingRepairRow.repair_started_at = now;
    pendingRepair.pendingRepairRow.repair_completes_at = now + repairDurationMs;
}

export function removePendingRepair(planetData: CoreType.PlanetData, pendingRepairId: number): void
{
    const pendingRepairIndex: number = planetData.dynamicPlanetData.pendingRepairs.findIndex((pendingRepair: CoreType.PendingRepair): boolean =>
    {
        return pendingRepair.pendingRepairRow.id === pendingRepairId;
    });

    if (pendingRepairIndex === -1)
    {
        return;
    }

    planetData.dynamicPlanetData.pendingRepairs.splice(pendingRepairIndex, 1);
}

export function buildPendingRepair(planetId: number, playerId: number, createdAt: number, unitQuantities: Map<GameType.UnitType, number>): CoreType.PendingRepair
{
    const pendingRepairRow: DBType.PendingRepairRow =
    {
        id: -1,
        planet_id: planetId,
        player_id: playerId,
        created_at: createdAt,
        repair_started_at: null,
        repair_completes_at: null,
    };

    const pendingRepairUnitRows: DBType.PendingRepairUnitRow[] = [];
    for (const [unitType, unitQuantity] of unitQuantities)
    {
        if (unitQuantity <= 0)
        {
            continue;
        }

        const pendingRepairUnitRow: DBType.PendingRepairUnitRow =
        {
            id: -1,
            pending_repair_id: -1,
            unit_type: unitType,
            unit_quantity: unitQuantity,
        };
        pendingRepairUnitRows.push(pendingRepairUnitRow);
    }

    const pendingRepair: CoreType.PendingRepair =
    {
        pendingRepairRow: pendingRepairRow,
        pendingRepairUnitRows: pendingRepairUnitRows,
    };

    return pendingRepair;
}
