import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as StaticDataHelper from "@/lib/gameplay/coreData/static/staticDataHelpers";
import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as UnitData from "@/lib/gameplay/dynamicData/planet/unitData";
import * as ResourceData from "@/lib/gameplay/dynamicData/planet/resourceData";
import * as FleetData from "@/lib/gameplay/dynamicData/planet/fleet/fleetData";
import * as MessageData from "@/lib/gameplay/dynamicData/player/messageData";
import * as MathHelp from "@/lib/helper/mathHelp";
import * as CombatResolver from "@/lib/gameplay/combat/resolver";
import * as Combat from "@/lib/gameplay/coreData/formula/combatFormulas";
import * as ServerPlanetManagement from "@/lib/gameplay/progressUpdate/server/serverPlanetManagement";
import * as DB from "@/lib/db/db";
import * as DBType from "@/lib/db/dbTypes";

const ATTACK_LOOT_FRACTION: number = 0.5;
const MOON_SIZE_SEED_OFFSET: number = 1;
const DEFENSE_REPAIR_SEED_OFFSET: number = 1_000_000;

type AttackOutcome =
{
    attackerLosses: Map<GameType.UnitType, number>;
    defenderLosses: Map<GameType.UnitType, number>;
    repairedDefenseQuantities: Map<GameType.UnitType, number>;
    lootedResourceQuantities: Map<GameType.ResourceType, number>;
    debrisResourceQuantities: Map<GameType.ResourceType, number>;
    moonFormed: boolean;
    numRounds: number;
    attackerDestroyed: boolean;
};

export function resolveAttackAction(originPlayerData: CoreType.PlayerData | null, targetPlayerData: CoreType.PlayerData | null, fleetMovement: CoreType.FleetMovement, serverData: CoreType.ServerData): void
{
    const fleetRow: DBType.FleetMovementRow = fleetMovement.fleetMovementRow;
    const originPlanetData: CoreType.PlanetData | null = originPlayerData !== null ? CoreType.getPlanetDataForId(originPlayerData.planetDatas, fleetRow.planet_origin_id) : null;
    const targetAddress: GameType.PlanetAddress = CoreType.getFleetTargetAddress(fleetRow);
    const aimedBody: CoreType.PlanetData | null = targetPlayerData !== null ? CoreType.getPlanetDataForAddress(targetPlayerData.planetDatas, targetAddress) : null;

    if (targetPlayerData === null || aimedBody === null)
    {
        FleetData.bounceFleetForMissingTarget(originPlayerData, fleetMovement);
        return;
    }

    const attackerUnitQuantities: Map<GameType.UnitType, number> = FleetData.buildUnitQuantitiesFromRows(fleetMovement.fleetMovementUnitRows);
    const defenderUnitQuantities: Map<GameType.UnitType, number> = buildDefenderCombatUnitQuantities(aimedBody);

    const combatResult: CombatResolver.CombatResult = CombatResolver.resolveCombat(
    {
        attackerUnitQuantities: attackerUnitQuantities,
        defenderUnitQuantities: defenderUnitQuantities,
        numRounds: 0,
    });

    const attackerLosses: Map<GameType.UnitType, number> = computeUnitLosses(attackerUnitQuantities, combatResult.attackerUnitQuantities);
    const defenderLosses: Map<GameType.UnitType, number> = computeUnitLosses(defenderUnitQuantities, combatResult.defenderUnitQuantities);

    UnitData.subtractPlanetUnits(aimedBody, defenderLosses);

    const debrisResourceQuantities: Map<GameType.ResourceType, number> = buildBattleDebris(attackerLosses, defenderLosses);
    const moonFormed: boolean = resolveDebrisAndMoon(targetPlayerData, targetAddress, fleetMovement, debrisResourceQuantities);

    const attackerSurvivingUnitTotal: number = MathHelp.calculateTotalQuantityMap(combatResult.attackerUnitQuantities);
    const defenderRemainingCombatTotal: number = computeDefenderCombatTotal(aimedBody);

    let lootedResourceQuantities: Map<GameType.ResourceType, number> = new Map<GameType.ResourceType, number>();
    if (defenderRemainingCombatTotal === 0 && attackerSurvivingUnitTotal > 0)
    {
        lootedResourceQuantities = FleetData.loadPlanetResourcesIntoFleet(aimedBody, fleetMovement, ATTACK_LOOT_FRACTION);
    }

    const repairedDefenseQuantities: Map<GameType.UnitType, number> = Combat.computeRepairedUnitQuantities(defenderLosses, fleetRow.seed + DEFENSE_REPAIR_SEED_OFFSET);
    UnitData.addPlanetUnits(aimedBody, repairedDefenseQuantities);

    const attackerDestroyed: boolean = attackerSurvivingUnitTotal === 0;
    if (attackerDestroyed === true)
    {
        FleetData.removeFleetMovement(aimedBody, fleetRow.id);
        if (originPlanetData !== null)
        {
            FleetData.removeFleetMovement(originPlanetData, fleetRow.id);
        }
    }
    else
    {
        rewriteAttackerFleetUnitRows(fleetMovement, combatResult.attackerUnitQuantities);
        FleetData.setFleetReturnTrip(aimedBody, fleetMovement);
    }

    const attackOutcome: AttackOutcome =
    {
        attackerLosses: attackerLosses,
        defenderLosses: defenderLosses,
        repairedDefenseQuantities: repairedDefenseQuantities,
        lootedResourceQuantities: lootedResourceQuantities,
        debrisResourceQuantities: debrisResourceQuantities,
        moonFormed: moonFormed,
        numRounds: combatResult.numRounds,
        attackerDestroyed: attackerDestroyed,
    };

    addCombatReportMessages(targetPlayerData, fleetMovement, attackOutcome);
    fleetMovement.resolutionState = CoreType.FleetMovementResolution.Resolved;
}

function buildDefenderCombatUnitQuantities(aimedBody: CoreType.PlanetData): Map<GameType.UnitType, number>
{
    const defenderCombatUnitQuantities: Map<GameType.UnitType, number> = new Map<GameType.UnitType, number>();
    for (const unitType of StaticDataHelper.getCombatUnitTypes())
    {
        const unitQuantity: number = UnitData.getUnitQuantity(aimedBody, unitType);
        if (unitQuantity > 0)
        {
            defenderCombatUnitQuantities.set(unitType, unitQuantity);
        }
    }

    return defenderCombatUnitQuantities;
}

function computeUnitLosses(preCombatQuantities: Map<GameType.UnitType, number>, postCombatQuantities: Map<GameType.UnitType, number>): Map<GameType.UnitType, number>
{
    const unitLosses: Map<GameType.UnitType, number> = new Map<GameType.UnitType, number>();
    for (const [unitType, preCombatQuantity] of preCombatQuantities)
    {
        const postCombatQuantity: number = postCombatQuantities.get(unitType) ?? 0;
        const lostQuantity: number = preCombatQuantity - postCombatQuantity;
        if (lostQuantity > 0)
        {
            unitLosses.set(unitType, lostQuantity);
        }
    }

    return unitLosses;
}

function buildBattleDebris(attackerLosses: Map<GameType.UnitType, number>, defenderLosses: Map<GameType.UnitType, number>): Map<GameType.ResourceType, number>
{
    const allLostUnitQuantities: Map<GameType.UnitType, number> = MathHelp.addQuantitiesTogether(attackerLosses, defenderLosses);
    return Combat.computeDebrisFromLosses(allLostUnitQuantities);
}

function computeDefenderCombatTotal(aimedBody: CoreType.PlanetData): number
{
    return MathHelp.calculateTotalQuantityMap(buildDefenderCombatUnitQuantities(aimedBody));
}

function rewriteAttackerFleetUnitRows(fleetMovement: CoreType.FleetMovement, survivingUnitQuantities: Map<GameType.UnitType, number>): void
{
    const survivingUnitRows: DBType.FleetMovementUnitRow[] = [];
    for (const [unitType, survivingQuantity] of survivingUnitQuantities)
    {
        if (survivingQuantity <= 0)
        {
            continue;
        }

        const survivingUnitRow: DBType.FleetMovementUnitRow =
        {
            fleet_id: fleetMovement.fleetMovementRow.id,
            unit_type: unitType,
            unit_quantity: survivingQuantity,
        };
        survivingUnitRows.push(survivingUnitRow);
    }

    fleetMovement.fleetMovementUnitRows = survivingUnitRows;
}

function resolveDebrisAndMoon(targetPlayerData: CoreType.PlayerData, targetAddress: GameType.PlanetAddress, fleetMovement: CoreType.FleetMovement, debrisResourceQuantities: Map<GameType.ResourceType, number>): boolean
{
    const debrisTotal: number = MathHelp.calculateTotalQuantityMap(debrisResourceQuantities);
    if (debrisTotal <= 0)
    {
        return false;
    }

    const claimedAt: number = fleetMovement.fleetMovementRow.started_at! + fleetMovement.fleetMovementRow.duration_at_start_time!;
    addDebrisToField(targetPlayerData, targetAddress, debrisResourceQuantities, claimedAt);

    const moonChancePercent: number = Combat.computeMoonChancePercent(debrisTotal);
    const moonRollSucceeded: boolean = Combat.rollMoonFormation(fleetMovement.fleetMovementRow.seed, moonChancePercent);
    if (moonRollSucceeded === false)
    {
        return false;
    }

    const moonAddress: GameType.PlanetAddress = { ...targetAddress, zone: GameType.PlanetZone.Moon };
    const existingMoonData: CoreType.PlanetData | null = CoreType.getPlanetDataForAddress(targetPlayerData.planetDatas, moonAddress);
    if (existingMoonData !== null)
    {
        return false;
    }

    const moonSizeFields: number = Combat.computeMoonSizeFields(fleetMovement.fleetMovementRow.seed + MOON_SIZE_SEED_OFFSET, moonChancePercent);
    createDefenderOwnedZone(targetPlayerData, moonAddress, moonSizeFields, claimedAt);
    return true;
}

function addDebrisToField(targetPlayerData: CoreType.PlayerData, targetAddress: GameType.PlanetAddress, debrisResourceQuantities: Map<GameType.ResourceType, number>, claimedAt: number): void
{
    const debrisAddress: GameType.PlanetAddress = { ...targetAddress, zone: GameType.PlanetZone.DebrisField };
    let debrisFieldData: CoreType.PlanetData | null = CoreType.getPlanetDataForAddress(targetPlayerData.planetDatas, debrisAddress);
    if (debrisFieldData === null)
    {
        debrisFieldData = createDefenderOwnedZone(targetPlayerData, debrisAddress, 0, claimedAt);
    }

    ResourceData.addPlanetResources(debrisFieldData, debrisResourceQuantities);
}

function createDefenderOwnedZone(targetPlayerData: CoreType.PlayerData, zoneAddress: GameType.PlanetAddress, size: number, claimedAt: number): CoreType.PlanetData
{
    const zoneId: number = ServerPlanetManagement.createZone(zoneAddress, targetPlayerData.playerRow.id, size, 0, claimedAt);
    const zoneRow: DBType.PlanetRow = DB.databaseConnection.prepare("SELECT * FROM planet WHERE id = ?").get(zoneId) as DBType.PlanetRow;
    const zoneData: CoreType.PlanetData =
    {
        planetRow: zoneRow,
        dynamicPlanetData: structuredClone(CoreType.EmptyPlanetData),
    };
    targetPlayerData.planetDatas.push(zoneData);

    return zoneData;
}

function buildCombatReportBody(targetPlayerData: CoreType.PlayerData, fleetMovement: CoreType.FleetMovement, attackOutcome: AttackOutcome): string
{
    const fleetRow: DBType.FleetMovementRow = fleetMovement.fleetMovementRow;
    const reportLines: string[] = [];

    if (attackOutcome.numRounds > 1)
    {
        const attackerName: string = StaticDataHelper.getPlayerName(targetPlayerData.publicPlayerRows, fleetRow.player_origin_id);
        const defenderName: string = StaticDataHelper.getPlayerName(targetPlayerData.publicPlayerRows, fleetRow.player_target_id);
        reportLines.push(`${attackerName} vs ${defenderName} over ${attackOutcome.numRounds} rounds.`);
    }

    reportLines.push(`Attacker losses: ${FleetData.buildUnitQuantitiesList(attackOutcome.attackerLosses, "none")}`);
    reportLines.push(`Defender losses: ${FleetData.buildUnitQuantitiesList(attackOutcome.defenderLosses, "none")}`);
    reportLines.push(`Defenses rebuilt: ${FleetData.buildUnitQuantitiesList(attackOutcome.repairedDefenseQuantities, "none")}`);
    reportLines.push(`Resources captured: ${FleetData.buildResourceQuantitiesList(attackOutcome.lootedResourceQuantities)}`);
    reportLines.push(`Debris field: ${FleetData.buildResourceQuantitiesList(attackOutcome.debrisResourceQuantities)}`);

    if (attackOutcome.moonFormed === true)
    {
        reportLines.push(`A moon formed at the target coordinates!`);
    }

    if (attackOutcome.attackerDestroyed === true)
    {
        reportLines.push(`Your attacking fleet was destroyed.`);
    }

    return reportLines.join("\n");
}

function addCombatReportMessages(targetPlayerData: CoreType.PlayerData, fleetMovement: CoreType.FleetMovement, attackOutcome: AttackOutcome): void
{
    const fleetRow: DBType.FleetMovementRow = fleetMovement.fleetMovementRow;
    const targetAddress: string = StaticDataHelper.formatPlanetAddress(fleetRow.planet_target_galaxy, fleetRow.planet_target_system, fleetRow.planet_target_slot, fleetRow.planet_target_zone as GameType.PlanetZone);
    const originAddress: string = StaticDataHelper.formatPlanetAddress(fleetRow.planet_origin_galaxy, fleetRow.planet_origin_system, fleetRow.planet_origin_slot, fleetRow.planet_origin_zone as GameType.PlanetZone);
    const receivedAt: number = fleetRow.started_at! + fleetRow.duration_at_start_time!;
    const reportBody: string = buildCombatReportBody(targetPlayerData, fleetMovement, attackOutcome);

    const attackerPlayerName: string = StaticDataHelper.getPlayerName(targetPlayerData.publicPlayerRows, fleetRow.player_origin_id);
    const defenderPlayerName: string = StaticDataHelper.getPlayerName(targetPlayerData.publicPlayerRows, fleetRow.player_target_id);

    fleetMovement.originMessageRow =
    {
        id: -1,
        player_id: fleetRow.player_origin_id,
        received_at: receivedAt,
        type: MessageData.MessageType.CombatReport,
        is_read: 0,
        title: `Combat Report at ${targetAddress}`,
        body: `Your fleet attacked ${defenderPlayerName}'s ${targetAddress}.\n${reportBody}`,
    };

    if (fleetRow.player_target_id !== null)
    {
        fleetMovement.targetMessageRow =
        {
            id: -1,
            player_id: fleetRow.player_target_id,
            received_at: receivedAt,
            type: MessageData.MessageType.CombatReport,
            is_read: 0,
            title: `Combat Report at ${targetAddress}`,
            body: `${attackerPlayerName} from ${originAddress} attacked your ${targetAddress}.\n${reportBody}`,
        };
    }
}
