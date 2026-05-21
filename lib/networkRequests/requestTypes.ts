import * as DBType from "@/lib/db/dbTypes";
import * as PlayerDataSerialization from "@/lib/helper/serialization";
import * as ServerDataType from "@/lib/gameplay/gameplayData/server/serverDataTypes";
import * as PlayerDataType from "@/lib/gameplay/gameplayData/player/playerDataTypes";

export type BaseServerResponse = 
{
	error: string | null,
}

export type BaseClientRequest = {}

//#region Data requests
export type UserRowRequest = BaseServerResponse &
{
	userRow: DBType.UserRow | null;
};

export type PlayerDataRequest = BaseServerResponse &
{
	serializedPlayerData: PlayerDataSerialization.SerializedPlayerData | null;
};

export type ServerDataStateRequest = BaseServerResponse &
{
	serverData: ServerDataType.ServerData | null;
};

export type AllPlanetDataRequest = BaseServerResponse &
{
	publicPlanetRows: DBType.PublicPlanetRow[];
}
export type OwnedPlanetDataRequest = BaseServerResponse &
{
	fullPlanetDatas: PlayerDataType.FullPlanetData[];
}
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

export type RefreshServer_ServerResponse = BaseServerResponse &
{
	serializedPlayerData: PlayerDataSerialization.SerializedPlayerData | null;
	serverData: ServerDataType.ServerData | null;
}

export type BuildingUpgrade_ClientRequest = BaseClientRequest &
{
	buildingType: number;
	planetId: number;
};
export type BuildingUpgrade_ServerResponse = BaseServerResponse &
{
	serializedPlayerData: PlayerDataSerialization.SerializedPlayerData | null;
};

export type ShipQuantityRequest =
{
	shipType: number;
	shipQuantity: number;
};
export type BuildShips_ClientRequest = BaseClientRequest &
{
	planetId: number;
	shipQuantities: ShipQuantityRequest[];
};
export type BuildShips_ServerResponse = BaseServerResponse &
{
	serializedPlayerData: PlayerDataSerialization.SerializedPlayerData | null;
};
//#endregion
