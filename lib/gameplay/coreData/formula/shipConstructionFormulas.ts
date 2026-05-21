import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as ServerDataType from "@/lib/gameplay/gameplayData/server/serverDataTypes";

export type ExtraShipConstructionData =
{
    currentShipyardLevel: number;
    maxHealth: number;
};

export const shipConstructionDurationSecondsFunctionMap: Map<number, (extraConstructionData: ExtraShipConstructionData, serverData: ServerDataType.ServerData | null) => number> = new Map
([
	[GameType.SHIP_1, (extraConstructionData: ExtraShipConstructionData, serverData: ServerDataType.ServerData | null): number => computeConstructionDurationSeconds_SimpleShip(extraConstructionData, SHIP_CONSTRUCTION_GENERIC_DATA, serverData)],
	[GameType.SHIP_2, (extraConstructionData: ExtraShipConstructionData, serverData: ServerDataType.ServerData | null): number => computeConstructionDurationSeconds_SimpleShip(extraConstructionData, SHIP_CONSTRUCTION_GENERIC_DATA, serverData)],
]);

type SimpleShipConstructionDurationData =
{
	divider: number;
};

const SHIP_CONSTRUCTION_GENERIC_DATA: SimpleShipConstructionDurationData =
{
	divider: 2500,
};

function computeConstructionDurationSeconds_SimpleShip(extraConstructionData: ExtraShipConstructionData, data: SimpleShipConstructionDurationData, serverData: ServerDataType.ServerData | null): number
{
	const timeMultiplier: number = serverData ? serverData.config.time_multiplier : 1;
    
	const durationHours: number = extraConstructionData.maxHealth / (data.divider * (extraConstructionData.currentShipyardLevel + 1));

	return Math.floor(durationHours * 3600 / timeMultiplier);
}