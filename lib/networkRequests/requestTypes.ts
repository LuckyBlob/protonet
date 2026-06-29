import * as DBType from "@/lib/db/dbTypes";
import * as Serialization from "@/lib/helper/serialization";
import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";

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
	serializedPlayerData: Serialization.SerializedPlayerData | null;
};

export type ServerDataStateRequest = BaseServerResponse &
{
	serverData: CoreType.ServerData | null;
};

export type AllPlanetDataRequest = BaseServerResponse &
{
	planets: Serialization.SerializedPublicPlanetData[];
}
export type OwnedPlanetDataRequest = BaseServerResponse &
{
	planetDatas: CoreType.PlanetData[];
}

//#endregion

//#region Action requests
//#region Authentication
export type BaseAuthenticationServerResponse = BaseServerResponse &
{
	username: string,
}

export type Register_ClientRequest = BaseClientRequest &
{
	username: string,
	email: string,
	password: string,
}

export type Login_ClientRequest = BaseClientRequest &
{
	identifier: string,
	password: string,
}

export type VerifyEmail_ClientRequest = BaseClientRequest &
{
	token: string,
}
export type VerifyEmail_ServerResponse = BaseServerResponse;

export type ResendVerification_ServerResponse = BaseServerResponse;

export type RequestPasswordReset_ClientRequest = BaseClientRequest &
{
	identifier: string,
}
export type RequestPasswordReset_ServerResponse = BaseServerResponse;

export type ResetPassword_ClientRequest = BaseClientRequest &
{
	token: string,
	password: string,
}
export type ResetPassword_ServerResponse = BaseServerResponse;

export type ChangeEmail_ClientRequest = BaseClientRequest &
{
	email: string,
}
export type ChangeEmail_ServerResponse = BaseServerResponse &
{
	userRow: DBType.UserRow | null,
}

export type ChangeUsername_ClientRequest = BaseClientRequest &
{
	username: string,
}
export type ChangeUsername_ServerResponse = BaseServerResponse &
{
	userRow: DBType.UserRow | null,
}

export type UpdatePlayerSettings_ClientRequest = BaseClientRequest &
{
	probesPerSend: number,
}
export type UpdatePlayerSettings_ServerResponse = BaseServerResponse &
{
	serializedPlayerData: Serialization.SerializedPlayerData | null,
}
//#endregion

export type RefreshServer_ServerResponse = BaseServerResponse &
{
	serializedPlayerData: Serialization.SerializedPlayerData | null;
	serverData: CoreType.ServerData | null;
}

export type BuildingUpgrade_ClientRequest = BaseClientRequest &
{
	buildingType: GameType.BuildingType;
	planetId: number;
};
export type BuildingUpgrade_ServerResponse = BaseServerResponse &
{
	serializedPlayerData: Serialization.SerializedPlayerData | null;
};

export type BuildingDeconstruction_ClientRequest = BaseClientRequest &
{
	buildingType: GameType.BuildingType;
	planetId: number;
};
export type BuildingDeconstruction_ServerResponse = BaseServerResponse &
{
	serializedPlayerData: Serialization.SerializedPlayerData | null;
};

export type CancelBuildingUpgrade_ClientRequest = BaseClientRequest &
{
	planetId: number;
};
export type CancelBuildingUpgrade_ServerResponse = BaseServerResponse &
{
	serializedPlayerData: Serialization.SerializedPlayerData | null;
};

export type CancelBuildingDeconstruction_ClientRequest = BaseClientRequest &
{
	planetId: number;
};
export type CancelBuildingDeconstruction_ServerResponse = BaseServerResponse &
{
	serializedPlayerData: Serialization.SerializedPlayerData | null;
};

export type Research_ClientRequest = BaseClientRequest &
{
	researchType: GameType.ResearchType;
	planetId: number;
};
export type Research_ServerResponse = BaseServerResponse &
{
	serializedPlayerData: Serialization.SerializedPlayerData | null;
};

export type BuildUnits_ClientRequest = BaseClientRequest &
{
	planetId: number;
	serializedUnitQuantities: Serialization.SerializedNumberNumberMap;
};
export type BuildUnits_ServerResponse = BaseServerResponse &
{
	serializedPlayerData: Serialization.SerializedPlayerData | null;
};

export type DestroyMissiles_ClientRequest = BaseClientRequest &
{
	planetId: number;
	serializedUnitQuantities: Serialization.SerializedNumberNumberMap;
};
export type DestroyMissiles_ServerResponse = BaseServerResponse &
{
	serializedPlayerData: Serialization.SerializedPlayerData | null;
};

export type SetBuildingEnergySetting_ClientRequest = BaseClientRequest &
{
	planetId: number;
	buildingType: GameType.BuildingType;
	energyPercentage: number;
};
export type SetBuildingEnergySetting_ServerResponse = BaseServerResponse &
{
	serializedPlayerData: Serialization.SerializedPlayerData | null;
};

export type SendFleet_ClientRequest = BaseClientRequest &
{
	originPlanetId: number;
	targetPlanetGalaxy: number;
	targetPlanetSystem: number;
	targetPlanetPosition: number;
	targetPlanetZone: GameType.PlanetZone;
	fleetAction: GameType.FleetActionType;
	serializedUnitQuantities: Serialization.SerializedNumberNumberMap;
	serializedResourceQuantities: Serialization.SerializedNumberNumberMap
	speedPercentage: number;
};
export type SendFleet_ServerResponse = BaseServerResponse &
{
	serializedPlayerData: Serialization.SerializedPlayerData | null;
};

export type RecallFleet_ClientRequest = BaseClientRequest &
{
	fleetId: number;
};
export type RecallFleet_ServerResponse = BaseServerResponse &
{
	serializedPlayerData: Serialization.SerializedPlayerData | null;
};

export type AbandonPlanet_ClientRequest = BaseClientRequest &
{
	planetId: number;
};
export type AbandonPlanet_ServerResponse = BaseServerResponse &
{
	serializedPlayerData: Serialization.SerializedPlayerData | null;
};

export type RenamePlanet_ClientRequest = BaseClientRequest &
{
	planetId: number;
	name: string;
};
export type RenamePlanet_ServerResponse = BaseServerResponse &
{
	serializedPlayerData: Serialization.SerializedPlayerData | null;
};

export type DeleteMessage_ClientRequest = BaseClientRequest &
{
	messageRowId: number;
	// When messageRowId === -1 the client is asking about a predicted message — these
	// fields let the server resolve it to its persisted row. Matching field set is
	// declared in MessageData.doMessagePreviewsMatch (single source of truth) and
	// mirrored into the corresponding WHERE clause server-side.
	predictedReceivedAt?: number;
	predictedTitle?: string;
};
export type DeleteMessage_ServerResponse = BaseServerResponse &
{
	serializedPlayerData: Serialization.SerializedPlayerData | null;
};

export type MarkMessageRead_ClientRequest = BaseClientRequest &
{
	messageRowId: number;
	// See DeleteMessage_ClientRequest for the predicted-id contract.
	predictedReceivedAt?: number;
	predictedTitle?: string;
};
export type MarkMessageRead_ServerResponse = BaseServerResponse &
{
	serializedPlayerData: Serialization.SerializedPlayerData | null;
};
//#endregion
