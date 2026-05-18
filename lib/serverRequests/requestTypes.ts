import * as DBType from "@/lib/db/dbTypes";
import * as PlayerDataType from "@/lib/playerData/playerDataTypes";
import * as PlayerDataSerialization from "@/lib/playerData/playerDataSerialization";
import * as ServerDataType from "@/lib/serverData/serverDataTypes";

export type BaseServerResponse = 
{
	error: string | null,
}

export type BaseClientRequest = {}

//#region Data requests
export type UserRowRequest = BaseServerResponse &
{
	userRow?: DBType.UserRow | null;
};

export type PlayerDataRequest = BaseServerResponse &
{
	serializedPlayerData?: PlayerDataSerialization.SerializedPlayerData | null;
};

export type ServerDataStateRequest = BaseServerResponse &
{
	serverData?: ServerDataType.ServerData | null;
};
//#endregion

//#region Action requests

//#region Authentication
export type BaseAuthenticationClientRequest = BaseClientRequest &
{
	username: string,
	password: string,
}
export type BaseAuthenticationServerResponse = BaseServerResponse &
{
	username: string,
}
//#endregion

export type BuildingUpgrade_ClientRequest = BaseClientRequest &
{
	buildingType: number;
	planetId: number;
};
export type BuildingUpgrade_ServerResponse = BaseServerResponse &
{
	serializedPlayerData?: PlayerDataSerialization.SerializedPlayerData | null;
};
//#endregion