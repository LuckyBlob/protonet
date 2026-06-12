import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as ColonizeAction from "@/lib/gameplay/dynamicData/planet/fleet/colonizeAction";
import * as FleetData from "@/lib/gameplay/dynamicData/planet/fleet/fleetData";

export class ServerFleetActionResolver extends FleetData.FleetActionResolver
{
    resolveFleetAction(targetPlayerData: CoreType.PlayerData | null, originPlayerData: CoreType.PlayerData | null, fleetMovement: CoreType.FleetMovement, serverData: CoreType.ServerData): CoreType.PlayerData | null
    {
        const updatedTargetPlayerData: CoreType.PlayerData | null = super.resolveFleetAction(targetPlayerData, originPlayerData, fleetMovement, serverData);

        if (fleetMovement.fleetMovementRow.fleet_action_type === GameType.FleetActionType.Colonize)
        {
            return ColonizeAction.resolveColonizeAction(originPlayerData, fleetMovement, serverData);
        }

        return updatedTargetPlayerData;
    }
}