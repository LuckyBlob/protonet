"use client"

import * as RequestType from "@/lib/serverRequests/requestTypes";

export const ActionRequest =
{
    Login:    { endpoint: "authentication/login",    name: "Login" },
    Register: { endpoint: "authentication/register", name: "Register" },
    Logout:   { endpoint: "authentication/logout",   name: "Logout" },
    RefreshServer:   { endpoint: "refreshServerData",   name: "RefreshServer" },
    UpgradeBuilding:   { endpoint: "buy/buildingLevel",   name: "UpgradeBuilding" },
} as const satisfies Record<string, validEndpoint>;

export interface ActionResponseMap
{
    Login: RequestType.BaseAuthenticationServerResponse;
    Register: RequestType.BaseAuthenticationServerResponse;
    Logout: RequestType.BaseAuthenticationServerResponse;
    RefreshServer: RequestType.RefreshServer_ServerResponse;
    UpgradeBuilding: RequestType.BuildingUpgrade_ServerResponse;
}
export interface ActionRequestMap
{
    Login: RequestType.BaseAuthenticationClientRequest;
    Register: RequestType.BaseAuthenticationClientRequest;
    Logout: RequestType.BaseAuthenticationClientRequest;
    RefreshServer: null;
    UpgradeBuilding: RequestType.BuildingUpgrade_ClientRequest;
}

export const DataRequest =
{
    UserInfo: { endpoint: "authentication/me",       name: "UserInfo" },
    PlayerData: { endpoint: "playerData",            name: "PlayerData" },
    ServerConfig: { endpoint: "serverDataState",       name: "ServerConfig" },
} as const satisfies Record<string, validEndpoint>;
export interface DataResponseMap
{
    UserInfo: RequestType.UserRowRequest;
    PlayerData: RequestType.PlayerDataRequest;
    ServerConfig: RequestType.ServerDataStateRequest;
}

export type DataRequest = (typeof DataRequest)[keyof typeof DataRequest];
export type ActionRequest = (typeof ActionRequest)[keyof typeof ActionRequest];

type validEndpoint =
{
    endpoint: string,
    name: string,
}

// no clue whats going on here, but allows to do : const registerResponse: ResponseForAction<typeof ActionRequest.Register>
export type ActionRequestKey = keyof typeof ActionRequest;
type FindActionKeyByValueObject<TObject> =
{
    [K in ActionRequestKey]: typeof ActionRequest[K] extends TObject ? K : never;
}[ActionRequestKey];

export type ResponseForAction<T extends typeof ActionRequest[ActionRequestKey]> = ActionResponseMap[FindActionKeyByValueObject<T>];
export type RequestForAction<T extends typeof ActionRequest[ActionRequestKey]> = ActionRequestMap[FindActionKeyByValueObject<T>];

// no clue whats going on here, but allows to do : const clientRequest: ResponseForData<typeof DataRequest.UserInfo>
export type DataRequestKey = keyof typeof DataRequest;
type FindDataKeyByValueObject<TObject> =
{
    [K in DataRequestKey]: typeof DataRequest[K] extends TObject ? K : never;
}[DataRequestKey];

export type ResponseForData<T extends typeof DataRequest[DataRequestKey]> = DataResponseMap[FindDataKeyByValueObject<T>];
export type RequestForData<T extends typeof DataRequest[DataRequestKey]> = DataResponseMap[FindDataKeyByValueObject<T>];