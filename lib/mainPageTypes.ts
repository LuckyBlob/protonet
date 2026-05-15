import * as PlayerDataType from "@/lib/playerData/playerDataTypes";

import * as ServerDataType from "@/lib/serverData/serverDataTypes";

import * as UseLoadCurrentUser from "@/lib/use/useLoadCurrentUser";

// consumers must check lsController[0].isLoading before reading
export type PSController  = [PlayerDataType.PlayerState, (value: PlayerDataType.PlayerState) => void];
export type SDSController  = [ServerDataType.ServerData, (value: ServerDataType.ServerData) => void];
export type CUController  = [UseLoadCurrentUser.CurrentUserResult, (value: UseLoadCurrentUser.CurrentUserResult) => void];
export type CVController  = [string, (value: string) => void];
export type LSController  = [PlayerDataType.LoadingState, (value: PlayerDataType.LoadingState) => void];