import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as ColonizeAction from "@/lib/gameplay/dynamicData/planet/fleet/colonizeAction";
import * as FleetData from "@/lib/gameplay/dynamicData/planet/fleet/fleetData";
import * as CollectAction from "@/lib/gameplay/dynamicData/planet/fleet/collectAction";
import * as StationAction from "@/lib/gameplay/dynamicData/planet/fleet/stationAction";
import * as RecycleAction from "@/lib/gameplay/dynamicData/planet/fleet/recycleAction";
import * as EspionageAction from "@/lib/gameplay/dynamicData/planet/fleet/espionageAction";
import * as TransportAction from "@/lib/gameplay/dynamicData/planet/fleet/transportAction";
import * as MissileLaunchAction from "@/lib/gameplay/dynamicData/planet/fleet/missileLaunchAction";
import * as AttackAction from "@/lib/gameplay/dynamicData/planet/fleet/attackAction";
import * as DestroyMoonAction from "@/lib/gameplay/dynamicData/planet/fleet/destroyMoonAction";

export function serverResolveFleetAction(targetPlayerData: CoreType.PlayerData | null, originPlayerData: CoreType.PlayerData, fleetMovement: CoreType.FleetMovement, serverData: CoreType.ServerData): CoreType.PlayerData | null
{
    switch (fleetMovement.fleetMovementRow.fleet_action_type)
    {
        case GameType.FleetActionType.Station:
        {
            StationAction.resolveStationAction(originPlayerData, targetPlayerData, fleetMovement, serverData);
            break;
        }
        case GameType.FleetActionType.Collect:
        {
            CollectAction.resolveCollectAction(originPlayerData, targetPlayerData, fleetMovement, serverData);
            break;
        }
        case GameType.FleetActionType.Transport:
        {
            TransportAction.resolveTransportAction(originPlayerData, targetPlayerData, fleetMovement, serverData);
            break;
        }
        case GameType.FleetActionType.Colonize:
        {
            targetPlayerData = ColonizeAction.resolveColonizeAction(originPlayerData, fleetMovement, serverData);
            break;
        }
        case GameType.FleetActionType.Recycle:
        {
            RecycleAction.resolveRecycleAction(originPlayerData, targetPlayerData, fleetMovement, serverData);
            break;
        }
        case GameType.FleetActionType.Espionage:
        {
            EspionageAction.resolveEspionageAction(originPlayerData, targetPlayerData, fleetMovement, serverData);
            break;
        }
        case GameType.FleetActionType.MissileLaunch:
        {
            MissileLaunchAction.resolveMissileLaunchAction(originPlayerData, targetPlayerData, fleetMovement, serverData);
            break;
        }
        case GameType.FleetActionType.Attack:
        {
            AttackAction.resolveAttackAction(originPlayerData, targetPlayerData, fleetMovement, serverData);
            break;
        }
        case GameType.FleetActionType.DestroyMoon:
        {
            DestroyMoonAction.resolveDestroyMoonAction(originPlayerData, targetPlayerData, fleetMovement, serverData);
            break;
        }
        default:
        {
            throw new Error(`UNREACHABLE: No resolver found for fleet action ${fleetMovement.fleetMovementRow.fleet_action_type}`);
        }
    }

    FleetData.addFleetMessagesToPlayerData(originPlayerData, fleetMovement);

    if (targetPlayerData !== null && targetPlayerData.playerRow.id !== originPlayerData.playerRow.id)
    {
        FleetData.addFleetMessagesToPlayerData(targetPlayerData, fleetMovement);
    }

    return targetPlayerData;
}
