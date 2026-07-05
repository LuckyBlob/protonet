import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as StaticDataHelper from "@/lib/gameplay/coreData/static/staticDataHelpers";
import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as FleetData from "@/lib/gameplay/dynamicData/planet/fleet/fleetData";
import * as MessageData from "@/lib/gameplay/dynamicData/player/messageData";
import * as CombatResolution from "@/lib/gameplay/dynamicData/planet/fleet/combatResolution";
import * as DBType from "@/lib/db/dbTypes";

export function resolveAttackAction(originPlayerData: CoreType.PlayerData, targetPlayerData: CoreType.PlayerData | null, fleetMovement: CoreType.FleetMovement, serverData: CoreType.ServerData): void
{
    const fleetRow: DBType.FleetMovementRow = fleetMovement.fleetMovementRow;

    const originPlanetData: CoreType.PlanetData | null = CoreType.getPlanetDataForId(originPlayerData.planetDatas, fleetRow.planet_origin_id);
    const targetAddress: GameType.PlanetAddress = CoreType.getFleetTargetAddress(fleetRow);
    const aimedBody: CoreType.PlanetData | null = targetPlayerData !== null ? CoreType.getPlanetDataForAddress(targetPlayerData.planetDatas, targetAddress) : null;

    if (targetPlayerData === null || aimedBody === null)
    {
        FleetData.bounceFleetForMissingTarget(originPlayerData, fleetMovement);
        return;
    }

    const battleAftermath: CombatResolution.BattleAftermath = CombatResolution.resolveBattleAndAftermath(originPlayerData, targetPlayerData, aimedBody, targetAddress, fleetMovement);

    const attackerDestroyed: boolean = battleAftermath.attackerSurvivingUnitTotal === 0;
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
        CombatResolution.rewriteAttackerFleetUnitRows(fleetMovement, battleAftermath.combatResult.attackerUnitQuantities);
        FleetData.setFleetReturnTrip(aimedBody, fleetMovement);
    }

    addCombatReportMessages(targetPlayerData, fleetMovement, battleAftermath, attackerDestroyed);
    fleetMovement.resolutionState = CoreType.FleetMovementResolution.Resolved;
}

function buildAttackReportBody(publicPlayerDatas: CoreType.PublicPlayerData[], fleetRow: DBType.FleetMovementRow, battleAftermath: CombatResolution.BattleAftermath, attackerDestroyed: boolean): string
{
    const reportLines: string[] = CombatResolution.buildBattleSummaryLines(publicPlayerDatas, fleetRow, battleAftermath);

    if (battleAftermath.moonFormed === true)
    {
        reportLines.push(`A moon formed at the target coordinates!`);
    }

    if (attackerDestroyed === true)
    {
        reportLines.push(`Your attacking fleet was destroyed.`);
    }

    return reportLines.join("\n");
}

function addCombatReportMessages(targetPlayerData: CoreType.PlayerData, fleetMovement: CoreType.FleetMovement, battleAftermath: CombatResolution.BattleAftermath, attackerDestroyed: boolean): void
{
    const fleetRow: DBType.FleetMovementRow = fleetMovement.fleetMovementRow;
    const targetAddress: string = StaticDataHelper.formatPlanetAddress(fleetRow.planet_target_galaxy, fleetRow.planet_target_system, fleetRow.planet_target_slot, fleetRow.planet_target_zone as GameType.PlanetZone);
    const originAddress: string = StaticDataHelper.formatPlanetAddress(fleetRow.planet_origin_galaxy, fleetRow.planet_origin_system, fleetRow.planet_origin_slot, fleetRow.planet_origin_zone as GameType.PlanetZone);
    const receivedAt: number = fleetRow.started_at! + fleetRow.duration_at_start_time!;
    const reportBody: string = buildAttackReportBody(targetPlayerData.publicPlayerDatas, fleetRow, battleAftermath, attackerDestroyed);

    const attackerPlayerName: string = StaticDataHelper.getPlayerName(targetPlayerData.publicPlayerDatas, fleetRow.player_origin_id);
    const defenderPlayerName: string = StaticDataHelper.getPlayerName(targetPlayerData.publicPlayerDatas, fleetRow.player_target_id);

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
