import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as StaticDataHelper from "@/lib/gameplay/coreData/static/staticDataHelpers";
import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as FleetData from "@/lib/gameplay/dynamicData/planet/fleet/fleetData";
import * as MessageData from "@/lib/gameplay/dynamicData/player/messageData";
import * as CombatResolution from "@/lib/gameplay/dynamicData/planet/fleet/combatResolution";
import * as Combat from "@/lib/gameplay/coreData/formula/combatFormulas";
import * as ServerPlanetManagement from "@/lib/gameplay/progressUpdate/server/serverPlanetManagement";
import * as DBType from "@/lib/db/dbTypes";

const MOON_DESTRUCTION_SEED_OFFSET: number = 2_000_000;
const FLEET_DESTRUCTION_SEED_OFFSET: number = 3_000_000;

type MoonDestructionOutcome =
{
    rolled: boolean;
    survivingDeathstarCount: number;
    moonDestructionChancePercent: number;
    attackerFleetDestructionChancePercent: number;
    moonDestroyed: boolean;
    attackerFleetDestroyedByMoon: boolean;
};

export function resolveDestroyMoonAction(originPlayerData: CoreType.PlayerData, targetPlayerData: CoreType.PlayerData | null, fleetMovement: CoreType.FleetMovement, serverData: CoreType.ServerData): void
{
    const fleetRow: DBType.FleetMovementRow = fleetMovement.fleetMovementRow;

    const originPlanetData: CoreType.PlanetData | null = CoreType.getPlanetDataForId(originPlayerData.planetDatas, fleetRow.planet_origin_id);
    const targetAddress: GameType.PlanetAddress = CoreType.getFleetTargetAddress(fleetRow);
    const aimedMoon: CoreType.PlanetData | null = targetPlayerData !== null ? CoreType.getPlanetDataForAddress(targetPlayerData.planetDatas, targetAddress) : null;

    if (targetPlayerData === null || aimedMoon === null)
    {
        FleetData.bounceFleetForMissingTarget(originPlayerData, fleetMovement);
        return;
    }

    const battleAftermath: CombatResolution.BattleAftermath = CombatResolution.resolveBattleAndAftermath(originPlayerData, targetPlayerData, aimedMoon, targetAddress, fleetMovement);

    const moonDestructionOutcome: MoonDestructionOutcome = resolveMoonDestructionRolls(aimedMoon, battleAftermath, fleetRow.seed);

    const attackerFleetDestroyed: boolean = battleAftermath.attackerSurvivingUnitTotal === 0 || moonDestructionOutcome.attackerFleetDestroyedByMoon === true;
    if (attackerFleetDestroyed === true)
    {
        FleetData.removeFleetMovement(aimedMoon, fleetRow.id);
        if (originPlanetData !== null)
        {
            FleetData.removeFleetMovement(originPlanetData, fleetRow.id);
        }
    }
    else
    {
        CombatResolution.rewriteAttackerFleetUnitRows(fleetMovement, battleAftermath.combatResult.attackerUnitQuantities);
        FleetData.setFleetReturnTrip(aimedMoon, fleetMovement);
    }

    if (moonDestructionOutcome.moonDestroyed === true)
    {
        destroyMoonZone(targetPlayerData, aimedMoon);
    }

    addDestroyMoonReportMessages(targetPlayerData, fleetMovement, battleAftermath, moonDestructionOutcome, attackerFleetDestroyed);
    fleetMovement.resolutionState = CoreType.FleetMovementResolution.Resolved;
}

function resolveMoonDestructionRolls(aimedMoon: CoreType.PlanetData, battleAftermath: CombatResolution.BattleAftermath, seed: number): MoonDestructionOutcome
{
    const survivingDeathstarCount: number = battleAftermath.combatResult.attackerUnitQuantities.get(GameType.UnitType.Deathstar) ?? 0;

    const moonDestructionOutcome: MoonDestructionOutcome =
    {
        rolled: false,
        survivingDeathstarCount: survivingDeathstarCount,
        moonDestructionChancePercent: 0,
        attackerFleetDestructionChancePercent: 0,
        moonDestroyed: false,
        attackerFleetDestroyedByMoon: false,
    };

    if (battleAftermath.attackerWon === false || survivingDeathstarCount <= 0)
    {
        return moonDestructionOutcome;
    }

    const moonSizeFields: number = aimedMoon.planetRow.size;
    moonDestructionOutcome.rolled = true;
    moonDestructionOutcome.moonDestructionChancePercent = Combat.computeMoonDestructionChancePercent(moonSizeFields, survivingDeathstarCount);
    moonDestructionOutcome.attackerFleetDestructionChancePercent = Combat.computeAttackerFleetDestructionChancePercent(moonSizeFields);
    moonDestructionOutcome.moonDestroyed = Combat.rollMoonDestruction(seed + MOON_DESTRUCTION_SEED_OFFSET, moonDestructionOutcome.moonDestructionChancePercent);
    moonDestructionOutcome.attackerFleetDestroyedByMoon = Combat.rollAttackerFleetDestruction(seed + FLEET_DESTRUCTION_SEED_OFFSET, moonDestructionOutcome.attackerFleetDestructionChancePercent);

    return moonDestructionOutcome;
}

function destroyMoonZone(targetPlayerData: CoreType.PlayerData, aimedMoon: CoreType.PlanetData): void
{
    const moonZoneId: number = aimedMoon.planetRow.id;

    const moonIndex: number = targetPlayerData.planetDatas.findIndex((planetData: CoreType.PlanetData): boolean => planetData.planetRow.id === moonZoneId);
    if (moonIndex !== -1)
    {
        targetPlayerData.planetDatas.splice(moonIndex, 1);
    }

    ServerPlanetManagement.deleteZone(moonZoneId);
}

function buildDestroyMoonReportBody(publicPlayerRows: DBType.PublicPlayerRow[], fleetRow: DBType.FleetMovementRow, battleAftermath: CombatResolution.BattleAftermath, moonDestructionOutcome: MoonDestructionOutcome, attackerFleetDestroyed: boolean): string
{
    const reportLines: string[] = CombatResolution.buildBattleSummaryLines(publicPlayerRows, fleetRow, battleAftermath);

    if (moonDestructionOutcome.rolled === true)
    {
        if (moonDestructionOutcome.moonDestroyed === true)
        {
            reportLines.push(`The moon was destroyed!`);
        }
        else
        {
            reportLines.push(`The moon withstood the Death Star assault.`);
        }

        if (moonDestructionOutcome.attackerFleetDestroyedByMoon === true)
        {
            reportLines.push(`The collapsing moon's gravity annihilated your entire fleet.`);
        }
    }
    else if (attackerFleetDestroyed === true)
    {
        reportLines.push(`Your attacking fleet was destroyed.`);
    }

    return reportLines.join("\n");
}

function addDestroyMoonReportMessages(targetPlayerData: CoreType.PlayerData, fleetMovement: CoreType.FleetMovement, battleAftermath: CombatResolution.BattleAftermath, moonDestructionOutcome: MoonDestructionOutcome, attackerFleetDestroyed: boolean): void
{
    const fleetRow: DBType.FleetMovementRow = fleetMovement.fleetMovementRow;
    const targetAddress: string = StaticDataHelper.formatPlanetAddress(fleetRow.planet_target_galaxy, fleetRow.planet_target_system, fleetRow.planet_target_slot, fleetRow.planet_target_zone as GameType.PlanetZone);
    const originAddress: string = StaticDataHelper.formatPlanetAddress(fleetRow.planet_origin_galaxy, fleetRow.planet_origin_system, fleetRow.planet_origin_slot, fleetRow.planet_origin_zone as GameType.PlanetZone);
    const receivedAt: number = fleetRow.started_at! + fleetRow.duration_at_start_time!;
    const reportBody: string = buildDestroyMoonReportBody(targetPlayerData.publicPlayerRows, fleetRow, battleAftermath, moonDestructionOutcome, attackerFleetDestroyed);

    const attackerPlayerName: string = StaticDataHelper.getPlayerName(targetPlayerData.publicPlayerRows, fleetRow.player_origin_id);
    const defenderPlayerName: string = StaticDataHelper.getPlayerName(targetPlayerData.publicPlayerRows, fleetRow.player_target_id);

    fleetMovement.originMessageRow =
    {
        id: -1,
        player_id: fleetRow.player_origin_id,
        received_at: receivedAt,
        type: MessageData.MessageType.CombatReport,
        is_read: 0,
        title: `Moon Destruction Report at ${targetAddress}`,
        body: `Your fleet attempted to destroy ${defenderPlayerName}'s moon at ${targetAddress}.\n${reportBody}`,
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
            title: `Moon Destruction Report at ${targetAddress}`,
            body: `${attackerPlayerName} from ${originAddress} attempted to destroy your moon at ${targetAddress}.\n${reportBody}`,
        };
    }
}
