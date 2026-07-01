"use client"

import * as RequestType from "@/lib/networkRequests/requestTypes";

//#region Actions
export const ActionRequest =
{
    Login:    { endpoint: "authentication/login",    name: "Login" },
    Register: { endpoint: "authentication/register", name: "Register" },
    DeleteUser: { endpoint: "authentication/deleteUser", name: "DeleteUser" },
    Logout:   { endpoint: "authentication/logout",   name: "Logout" },
    VerifyEmail: { endpoint: "authentication/verify", name: "VerifyEmail" },
    ResendVerification: { endpoint: "authentication/resendVerification", name: "ResendVerification" },
    RequestPasswordReset: { endpoint: "authentication/requestPasswordReset", name: "RequestPasswordReset" },
    ResetPassword: { endpoint: "authentication/resetPassword", name: "ResetPassword" },
    ChangeEmail: { endpoint: "authentication/changeEmail", name: "ChangeEmail" },
    ChangeUsername: { endpoint: "authentication/changeUsername", name: "ChangeUsername" },
    UpdatePlayerSettings: { endpoint: "settings/update", name: "UpdatePlayerSettings" },
    RefreshServer:   { endpoint: "refreshServerData",   name: "RefreshServer" },
    UpgradeBuilding:   { endpoint: "buy/upgradeBuilding",   name: "UpgradeBuilding" },
    CancelBuildingUpgrade:   { endpoint: "buy/cancelBuildingUpgrade",   name: "CancelBuildingUpgrade" },
    DeconstructBuilding:   { endpoint: "buy/deconstructBuilding",   name: "DeconstructBuilding" },
    CancelBuildingDeconstruction:   { endpoint: "buy/cancelBuildingDeconstruction",   name: "CancelBuildingDeconstruction" },
    UpgradeResearch:   { endpoint: "buy/upgradeResearch",   name: "UpgradeResearch" },
    BuildUnits:   { endpoint: "buy/buildUnits",   name: "BuildUnits" },
    StartRepair:   { endpoint: "buy/startRepair",   name: "StartRepair" },
    CollectRepair:   { endpoint: "buy/collectRepair",   name: "CollectRepair" },
    BurnWreckField:   { endpoint: "buy/burnWreckField",   name: "BurnWreckField" },
    DestroyMissiles:   { endpoint: "buy/destroyMissiles",   name: "DestroyMissiles" },
    Scan:   { endpoint: "buy/scan",   name: "Scan" },
    JumpGate:   { endpoint: "buy/jumpGate",   name: "JumpGate" },
    SetBuildingEnergySetting:   { endpoint: "buildings/setEnergySetting",   name: "SetBuildingEnergySetting" },
    SendFleet:   { endpoint: "buy/sendFleet",   name: "SendFleet" },
    RecallFleet:   { endpoint: "buy/recallFleet",   name: "RecallFleet" },
    AbandonPlanet:   { endpoint: "planets/abandon",   name: "AbandonPlanet" },
    RenamePlanet:   { endpoint: "planet/rename",   name: "RenamePlanet" },
    DeleteMessage:   { endpoint: "message/delete",   name: "DeleteMessage" },
    MarkMessageRead: { endpoint: "message/markRead", name: "MarkMessageRead" },
} as const satisfies Record<string, validEndpoint>;
export type ActionRequestMap =
{
    Login: RequestType.Login_ClientRequest;
    Register: RequestType.Register_ClientRequest;
    DeleteUser: RequestType.BaseClientRequest;
    Logout: null;
    VerifyEmail: RequestType.VerifyEmail_ClientRequest;
    ResendVerification: null;
    RequestPasswordReset: RequestType.RequestPasswordReset_ClientRequest;
    ResetPassword: RequestType.ResetPassword_ClientRequest;
    ChangeEmail: RequestType.ChangeEmail_ClientRequest;
    ChangeUsername: RequestType.ChangeUsername_ClientRequest;
    UpdatePlayerSettings: RequestType.UpdatePlayerSettings_ClientRequest;
    RefreshServer: null;
    UpgradeBuilding: RequestType.BuildingUpgrade_ClientRequest;
    CancelBuildingUpgrade: RequestType.CancelBuildingUpgrade_ClientRequest;
    DeconstructBuilding: RequestType.BuildingDeconstruction_ClientRequest;
    CancelBuildingDeconstruction: RequestType.CancelBuildingDeconstruction_ClientRequest;
    UpgradeResearch: RequestType.Research_ClientRequest;
    BuildUnits: RequestType.BuildUnits_ClientRequest;
    StartRepair: RequestType.StartRepair_ClientRequest;
    CollectRepair: RequestType.CollectRepair_ClientRequest;
    BurnWreckField: RequestType.BurnWreckField_ClientRequest;
    DestroyMissiles: RequestType.DestroyMissiles_ClientRequest;
    Scan: RequestType.Scan_ClientRequest;
    JumpGate: RequestType.JumpGate_ClientRequest;
    SetBuildingEnergySetting: RequestType.SetBuildingEnergySetting_ClientRequest;
    SendFleet: RequestType.SendFleet_ClientRequest;
    RecallFleet: RequestType.RecallFleet_ClientRequest;
    AbandonPlanet: RequestType.AbandonPlanet_ClientRequest;
    RenamePlanet: RequestType.RenamePlanet_ClientRequest;
    DeleteMessage: RequestType.DeleteMessage_ClientRequest;
    MarkMessageRead: RequestType.MarkMessageRead_ClientRequest;
}
export type ActionResponseMap =
{
    Login: RequestType.BaseAuthenticationServerResponse;
    Register: RequestType.BaseAuthenticationServerResponse;
    DeleteUser: RequestType.BaseServerResponse;
    Logout: RequestType.BaseAuthenticationServerResponse;
    VerifyEmail: RequestType.VerifyEmail_ServerResponse;
    ResendVerification: RequestType.ResendVerification_ServerResponse;
    RequestPasswordReset: RequestType.RequestPasswordReset_ServerResponse;
    ResetPassword: RequestType.ResetPassword_ServerResponse;
    ChangeEmail: RequestType.ChangeEmail_ServerResponse;
    ChangeUsername: RequestType.ChangeUsername_ServerResponse;
    UpdatePlayerSettings: RequestType.UpdatePlayerSettings_ServerResponse;
    RefreshServer: RequestType.RefreshServer_ServerResponse;
    UpgradeBuilding: RequestType.BuildingUpgrade_ServerResponse;
    CancelBuildingUpgrade: RequestType.CancelBuildingUpgrade_ServerResponse;
    DeconstructBuilding: RequestType.BuildingDeconstruction_ServerResponse;
    CancelBuildingDeconstruction: RequestType.CancelBuildingDeconstruction_ServerResponse;
    UpgradeResearch: RequestType.Research_ServerResponse;
    BuildUnits: RequestType.BuildUnits_ServerResponse;
    StartRepair: RequestType.StartRepair_ServerResponse;
    CollectRepair: RequestType.CollectRepair_ServerResponse;
    BurnWreckField: RequestType.BurnWreckField_ServerResponse;
    DestroyMissiles: RequestType.DestroyMissiles_ServerResponse;
    Scan: RequestType.Scan_ServerResponse;
    JumpGate: RequestType.JumpGate_ServerResponse;
    SetBuildingEnergySetting: RequestType.SetBuildingEnergySetting_ServerResponse;
    SendFleet: RequestType.SendFleet_ServerResponse;
    RecallFleet: RequestType.RecallFleet_ServerResponse;
    AbandonPlanet: RequestType.AbandonPlanet_ServerResponse;
    RenamePlanet: RequestType.RenamePlanet_ServerResponse;
    DeleteMessage: RequestType.DeleteMessage_ServerResponse;
    MarkMessageRead: RequestType.MarkMessageRead_ServerResponse;
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
export type DataRequestMap =
{
    UserInfo: null;
    PlayerData: null;
    ServerConfig: null;
    AllPlanets: null;
    OwnedPlanets: null;
}
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
export type RequestForData<T extends typeof DataRequest[DataRequestKey]> = DataRequestMap[FindDataKeyByValueObject<T>];
//#endregion