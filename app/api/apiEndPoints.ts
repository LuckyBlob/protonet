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