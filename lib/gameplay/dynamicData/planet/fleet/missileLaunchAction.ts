import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as StaticDataHelper from "@/lib/gameplay/coreData/static/staticDataHelpers";
import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as FleetData from "@/lib/gameplay/dynamicData/planet/fleet/fleetData";
import * as UnitData from "@/lib/gameplay/dynamicData/planet/unitData";
import * as CombatResearch from "@/lib/gameplay/coreData/formula/combatResearchFunctions";
import * as MessageData from "@/lib/gameplay/dynamicData/player/messageData";
import * as ThingHelpers from "@/lib/gameplay/coreData/thing/thingHelpers";
import * as ThingDataHelpers from "@/lib/gameplay/coreData/thing/thingDataHelpers";
import * as MathHelp from "@/lib/helper/mathHelp";
import * as DBType from "@/lib/db/dbTypes";

const STORED_MISSILES_DESTROYED_PER_SURVIVING_MISSILE: number = 8;

export type MissileCombatResult =
{
    incomingMissiles: number;
    interceptedMissiles: number;
    destroyedDefenseQuantities: Map<GameType.UnitType, number>;
    destroyedStoredMissiles: number;
};

function countAlivePoolInstances(pool: Map<GameType.UnitType, number[]>): number
{
    let total: number = 0;
    for (const [, hulls] of pool)
    {
        total += hulls.length;
    }

    return total;
}

function pickTargetType(pool: Map<GameType.UnitType, number[]>, unitFocus: GameType.UnitType | null, nextRandom: () => number): GameType.UnitType
{
    if (unitFocus !== null && pool.has(unitFocus) === true)
    {
        return unitFocus;
    }

    const aliveInstanceCount: number = countAlivePoolInstances(pool);
    let pickedInstanceIndex: number = Math.floor(nextRandom() * aliveInstanceCount);
    for (const [unitType, hulls] of pool)
    {
        if (pickedInstanceIndex < hulls.length)
        {
            return unitType;
        }

        pickedInstanceIndex -= hulls.length;
    }

    throw new Error(`UNREACHABLE: pickTargetType found no alive defense instance among ${aliveInstanceCount}.`);
}

export function resolveMissileCombat(incomingMissiles: number, interceptorCount: number, defenseUnitQuantities: Map<GameType.UnitType, number>, defenseHullByType: Map<GameType.UnitType, number>, damagePerMissile: number, storedInterplanetaryMissileCount: number, unitFocus: GameType.UnitType | null, seed: number): MissileCombatResult
{
    const interceptedMissiles: number = Math.min(incomingMissiles, interceptorCount);
    let survivingMissiles: number = incomingMissiles - interceptedMissiles;

    const pool: Map<GameType.UnitType, number[]> = new Map<GameType.UnitType, number[]>();
    for (const [unitType, unitQuantity] of defenseUnitQuantities)
    {
        if (unitQuantity <= 0)
        {
            continue;
        }

        const unitHull: number | undefined = defenseHullByType.get(unitType);
        if (unitHull === undefined)
        {
            throw new Error(`resolveMissileCombat missing hull for defense unit type ${unitType}.`);
        }

        pool.set(unitType, new Array<number>(unitQuantity).fill(unitHull));
    }

    const destroyedDefenseQuantities: Map<GameType.UnitType, number> = new Map<GameType.UnitType, number>();
    let rngCounter: number = 0;
    const nextRandom = (): number =>
    {
        const randomValue: number = MathHelp.seededRandom(seed + rngCounter);
        rngCounter += 1;
        return randomValue;
    };

    while (survivingMissiles > 0 && countAlivePoolInstances(pool) > 0)
    {
        const targetType: GameType.UnitType = pickTargetType(pool, unitFocus, nextRandom);
        const hulls: number[] = pool.get(targetType)!;
        const instanceIndex: number = Math.floor(nextRandom() * hulls.length);

        hulls[instanceIndex] -= damagePerMissile;
        if (hulls[instanceIndex] <= 0)
        {
            hulls[instanceIndex] = hulls[hulls.length - 1];
            hulls.pop();
            if (hulls.length === 0)
            {
                pool.delete(targetType);
            }

            destroyedDefenseQuantities.set(targetType, (destroyedDefenseQuantities.get(targetType) ?? 0) + 1);
        }

        survivingMissiles -= 1;
    }

    let destroyedStoredMissiles: number = 0;
    if (survivingMissiles > 0 && countAlivePoolInstances(pool) === 0 && storedInterplanetaryMissileCount > 0)
    {
        destroyedStoredMissiles = Math.min(storedInterplanetaryMissileCount, survivingMissiles * STORED_MISSILES_DESTROYED_PER_SURVIVING_MISSILE);
    }

    const result: MissileCombatResult =
    {
        incomingMissiles: incomingMissiles,
        interceptedMissiles: interceptedMissiles,
        destroyedDefenseQuantities: destroyedDefenseQuantities,
        destroyedStoredMissiles: destroyedStoredMissiles,
    };

    return result;
}

export function resolveMissileLaunchAction(originPlayerData: CoreType.PlayerData | null, targetPlayerData: CoreType.PlayerData | null, fleetMovement: CoreType.FleetMovement, serverData: CoreType.ServerData): void
{
    const fleetRow: DBType.FleetMovementRow = fleetMovement.fleetMovementRow;
    const originPlanetData: CoreType.PlanetData | null = originPlayerData !== null ? CoreType.getPlanetDataForId(originPlayerData.planetDatas, fleetRow.planet_origin_id) : null;
    const targetAddress: GameType.PlanetAddress = CoreType.getFleetTargetAddress(fleetRow);
    const aimedBody: CoreType.PlanetData | null = targetPlayerData !== null ? CoreType.getPlanetDataForAddress(targetPlayerData.planetDatas, targetAddress) : null;

    if (targetPlayerData === null || aimedBody === null)
    {
        addDeepSpaceMessage(originPlayerData, fleetMovement);
        removeMissileFleet(originPlanetData, null, fleetMovement);
        fleetMovement.resolutionState = CoreType.FleetMovementResolution.Resolved;
        return;
    }

    const interceptorPlanetAddress: GameType.PlanetAddress =
    {
        galaxy: targetAddress.galaxy,
        system: targetAddress.system,
        slot: targetAddress.slot,
        zone: GameType.PlanetZone.Planet,
    };
    const interceptorPlanetData: CoreType.PlanetData | null = CoreType.getPlanetDataForAddress(targetPlayerData.planetDatas, interceptorPlanetAddress);

    const incomingMissiles: number = countLaunchedMissiles(fleetMovement);
    const interceptorCount: number = interceptorPlanetData !== null ? UnitData.getUnitQuantity(interceptorPlanetData, GameType.UnitType.InterceptorMissile) : 0;

    const interplanetaryMissileStats: GameType.UnitStats = StaticDataHelper.getUnitStats(GameType.UnitType.InterplanetaryMissile);
    const damagePerMissile: number = originPlayerData !== null ? CombatResearch.computeUnitWeaponPower(originPlayerData, interplanetaryMissileStats) : interplanetaryMissileStats.weaponPower;

    const defenseUnitQuantities: Map<GameType.UnitType, number> = new Map<GameType.UnitType, number>();
    const defenseHullByType: Map<GameType.UnitType, number> = new Map<GameType.UnitType, number>();
    for (const defenseUnitType of StaticDataHelper.getUnitsByCategory(GameType.UnitCategory.Defense))
    {
        const defenseQuantity: number = UnitData.getUnitQuantity(aimedBody, defenseUnitType);
        if (defenseQuantity <= 0)
        {
            continue;
        }

        defenseUnitQuantities.set(defenseUnitType, defenseQuantity);
        defenseHullByType.set(defenseUnitType, CombatResearch.computeUnitArmour(targetPlayerData, StaticDataHelper.getUnitStats(defenseUnitType)));
    }

    const storedInterplanetaryMissileCount: number = UnitData.getUnitQuantity(aimedBody, GameType.UnitType.InterplanetaryMissile);
    const unitFocus: GameType.UnitType | null = fleetRow.unit_focus === null ? null : (fleetRow.unit_focus as GameType.UnitType);

    const combatResult: MissileCombatResult = resolveMissileCombat(incomingMissiles, interceptorCount, defenseUnitQuantities, defenseHullByType, damagePerMissile, storedInterplanetaryMissileCount, unitFocus, fleetRow.seed);

    if (combatResult.interceptedMissiles > 0 && interceptorPlanetData !== null)
    {
        UnitData.subtractPlanetUnit(interceptorPlanetData, GameType.UnitType.InterceptorMissile, combatResult.interceptedMissiles);
    }

    for (const [destroyedUnitType, destroyedQuantity] of combatResult.destroyedDefenseQuantities)
    {
        UnitData.subtractPlanetUnit(aimedBody, destroyedUnitType, destroyedQuantity);
    }

    if (combatResult.destroyedStoredMissiles > 0)
    {
        UnitData.subtractPlanetUnit(aimedBody, GameType.UnitType.InterplanetaryMissile, combatResult.destroyedStoredMissiles);
    }

    addMissileReportMessages(originPlayerData, targetPlayerData, fleetMovement, combatResult);
    removeMissileFleet(originPlanetData, aimedBody, fleetMovement);
    fleetMovement.resolutionState = CoreType.FleetMovementResolution.Resolved;
}

function countLaunchedMissiles(fleetMovement: CoreType.FleetMovement): number
{
    const unitQuantities: Map<GameType.UnitType, number> = FleetData.buildUnitQuantitiesFromRows(fleetMovement.fleetMovementUnitRows);
    return unitQuantities.get(GameType.UnitType.InterplanetaryMissile) ?? 0;
}

function removeMissileFleet(originPlanetData: CoreType.PlanetData | null, aimedBody: CoreType.PlanetData | null, fleetMovement: CoreType.FleetMovement): void
{
    if (aimedBody !== null)
    {
        FleetData.removeFleetMovement(aimedBody, fleetMovement.fleetMovementRow.id);
    }

    if (originPlanetData !== null)
    {
        FleetData.removeFleetMovement(originPlanetData, fleetMovement.fleetMovementRow.id);
    }
}

function buildMissileReportBody(combatResult: MissileCombatResult): string
{
    const reportLines: string[] = [];
    reportLines.push(`Missiles launched: ${combatResult.incomingMissiles}`);
    reportLines.push(`Intercepted by anti-ballistic missiles: ${combatResult.interceptedMissiles}`);
    reportLines.push(`Defenses destroyed: ${FleetData.buildUnitQuantitiesList(combatResult.destroyedDefenseQuantities, "no defenses")}`);

    if (combatResult.destroyedStoredMissiles > 0)
    {
        const storedMissileName: string = ThingDataHelpers.getSpecificThingName(ThingHelpers.unit(GameType.UnitType.InterplanetaryMissile));
        reportLines.push(`Stored missiles destroyed: ${combatResult.destroyedStoredMissiles} ${storedMissileName}`);
    }

    return reportLines.join("\n");
}

function getMissileReportReceivedAt(fleetMovement: CoreType.FleetMovement): number
{
    return fleetMovement.fleetMovementRow.started_at! + fleetMovement.fleetMovementRow.duration_at_start_time!;
}

function addMissileReportMessages(originPlayerData: CoreType.PlayerData | null, targetPlayerData: CoreType.PlayerData, fleetMovement: CoreType.FleetMovement, combatResult: MissileCombatResult): void
{
    const fleetRow: DBType.FleetMovementRow = fleetMovement.fleetMovementRow;
    const targetAddress: string = StaticDataHelper.formatPlanetAddress(fleetRow.planet_target_galaxy, fleetRow.planet_target_system, fleetRow.planet_target_slot, fleetRow.planet_target_zone as GameType.PlanetZone);
    const originAddress: string = StaticDataHelper.formatPlanetAddress(fleetRow.planet_origin_galaxy, fleetRow.planet_origin_system, fleetRow.planet_origin_slot, fleetRow.planet_origin_zone as GameType.PlanetZone);
    const receivedAt: number = getMissileReportReceivedAt(fleetMovement);
    const reportBody: string = buildMissileReportBody(combatResult);

    if (originPlayerData !== null)
    {
        const targetPlayerName: string = StaticDataHelper.getPlayerName(originPlayerData.publicPlayerRows, fleetRow.player_target_id);
        fleetMovement.originMessageRow =
        {
            id: -1,
            player_id: fleetRow.player_origin_id,
            received_at: receivedAt,
            type: MessageData.MessageType.MissileReport,
            is_read: 0,
            title: `Missile Launch Report on ${targetPlayerName} at ${targetAddress}`,
            body: `Missile strike on ${targetPlayerName}'s ${targetAddress}.\n${reportBody}`,
        };
    }

    if (fleetRow.player_target_id !== null)
    {
        const originPlayerName: string = StaticDataHelper.getPlayerName(targetPlayerData.publicPlayerRows, fleetRow.player_origin_id);
        fleetMovement.targetMessageRow =
        {
            id: -1,
            player_id: fleetRow.player_target_id,
            received_at: receivedAt,
            type: MessageData.MessageType.MissileReport,
            is_read: 0,
            title: `Missile Attack at ${targetAddress}`,
            body: `${originPlayerName} from ${originAddress} launched missiles at your ${targetAddress}.\n${reportBody}`,
        };
    }
}

function addDeepSpaceMessage(originPlayerData: CoreType.PlayerData | null, fleetMovement: CoreType.FleetMovement): void
{
    if (originPlayerData === null)
    {
        return;
    }

    const fleetRow: DBType.FleetMovementRow = fleetMovement.fleetMovementRow;
    const targetAddress: string = StaticDataHelper.formatPlanetAddress(fleetRow.planet_target_galaxy, fleetRow.planet_target_system, fleetRow.planet_target_slot, fleetRow.planet_target_zone as GameType.PlanetZone);

    fleetMovement.originMessageRow =
    {
        id: -1,
        player_id: fleetRow.player_origin_id,
        received_at: getMissileReportReceivedAt(fleetMovement),
        type: MessageData.MessageType.MissileReport,
        is_read: 0,
        title: `Missile Launch Report at ${targetAddress}`,
        body: `Your missiles found no target at ${targetAddress} and were lost in deep space.`,
    };
}
