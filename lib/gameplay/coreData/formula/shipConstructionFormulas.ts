import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as GameType from "@/lib/gameplay/coreData/type/gameTypes"

type SimpleShipConstructionDurationData =
{
    divider: number;
};

const SHIP_CONSTRUCTION_GENERIC_DATA: SimpleShipConstructionDurationData =
{
    divider: 2500,
};

export function computeConstructionDurationSeconds(shipType: number, currentShipyardLevel: number, serverData: CoreType.ServerData | null): number | null
{
    const shipStats: GameType.ShipStats | undefined = GameType.SHIP_STATS.get(shipType);
    if (shipStats === undefined)
    {
        return null;
    }
    return computeConstructionDurationSeconds_SimpleShip(currentShipyardLevel, shipStats.maxHealth, SHIP_CONSTRUCTION_GENERIC_DATA, serverData);
}

function computeConstructionDurationSeconds_SimpleShip(currentShipyardLevel: number, maxHealth: number, data: SimpleShipConstructionDurationData, serverData: CoreType.ServerData | null): number
{
    const timeMultiplier: number = serverData !== null ? serverData.config.time_multiplier : 1;
    const durationHours: number = maxHealth / (data.divider * (currentShipyardLevel + 1));
    return durationHours * 3600 / timeMultiplier;
}
