"use client"

import * as RequestType from "@/lib/networkRequests/requestTypes";

//#region Actions
export const ActionRequest =
{
    Login:    { endpoint: "authentication/login",    name: "Login" },
    Register: { endpoint: "authentication/register", name: "Register" },
    Logout:   { endpoint: "authentication/logout",   name: "Logout" },
    RefreshServer:   { endpoint: "refreshServerData",   name: "RefreshServer" },
    UpgradeBuilding:   { endpoint: "buy/upgradeBuilding",   name: "UpgradeBuilding" },
    BuildShips:   { endpoint: "buy/buildShips",   name: "BuildShips" },
    SendFleet:   { endpoint: "buy/sendFleet",   name: "SendFleet" },
} as const satisfies Record<string, validEndpoint>;
export type ActionRequestMap = 
{
    Login: RequestType.BaseAuthenticationClientRequest;
    Register: RequestType.BaseAuthenticationClientRequest;
    Logout: null;
    RefreshServer: null;
    UpgradeBuilding: RequestType.BuildingUpgrade_ClientRequest;
    BuildShips: RequestType.BuildShips_ClientRequest;
    SendFleet: RequestType.SendFleet_ClientRequest;
}
export type ActionResponseMap = 
{
    Login: RequestType.BaseAuthenticationServerResponse;
    Register: RequestType.BaseAuthenticationServerResponse;
    Logout: RequestType.BaseAuthenticationServerResponse;
    RefreshServer: RequestType.RefreshServer_ServerResponse;
    UpgradeBuilding: RequestType.BuildingUpgrade_ServerResponse;
    BuildShips: RequestType.BuildShips_ServerResponse;
    SendFleet: RequestType.SendFleet_ServerResponse;
}
//#endregion

//#region Data
export const DataRequest =
{
    UserInfo: { endpoint: "authentication/me",       name: "UserInfo" },
    PlayerData: { endpoint: "playerData",            name: "PlayerData" },
    ServerConfig: { endpoint: "serverDataState",       name: "ServerConfig" },
    AllPlanets: { endpoint: "planets/all",       name: "AllPlanets" },
    OwnedPlanets: { endpoint: "planets/owned",       name: "OwnedPlanets" },
} as const satisfies Record<string, validEndpoint>;
export type DataResponseMap = 
{
    UserInfo: RequestType.UserRowRequest;
    PlayerData: RequestType.PlayerDataRequest;
    ServerConfig: RequestType.ServerDataStateRequest;
    AllPlanets: RequestType.AllPlanetDataRequest;
    OwnedPlanets: RequestType.OwnedPlanetDataRequest;
}
//#endregion

//#region Inner workings (magic!)
export type DataRequest = (typeof DataRequest)[keyof typeof DataRequest];
export type ActionRequest = (typeof ActionRequest)[keyof typeof ActionRequest];

type validEndpoint =
{
    endpoint: string,
    name: string,
}

// no clue whats going on here, but allows to do : const registerResponse: ResponseForAction<typeof ActionRequest.Register>
type ActionRequestKey = keyof typeof ActionRequest;
type FindActionKeyByValueObject<TObject> =
{
    [K in ActionRequestKey]: typeof ActionRequest[K] extends TObject ? K : never;
}[ActionRequestKey];

export type ResponseForAction<T extends typeof ActionRequest[ActionRequestKey]> = ActionResponseMap[FindActionKeyByValueObject<T>];
export type RequestForAction<T extends typeof ActionRequest[ActionRequestKey]> = ActionRequestMap[FindActionKeyByValueObject<T>];

// no clue whats going on here, but allows to do : const clientRequest: ResponseForData<typeof DataRequest.UserInfo>
type DataRequestKey = keyof typeof DataRequest;
type FindDataKeyByValueObject<TObject> =
{
    [K in DataRequestKey]: typeof DataRequest[K] extends TObject ? K : never;
}[DataRequestKey];

export type ResponseForData<T extends typeof DataRequest[DataRequestKey]> = DataResponseMap[FindDataKeyByValueObject<T>];
//#endregion