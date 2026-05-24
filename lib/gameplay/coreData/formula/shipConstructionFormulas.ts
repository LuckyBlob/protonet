import * as ServerDataType from "@/lib/gameplay/gameplayData/server/serverDataTypes";
import * as AssociationMaps from "@/lib/gameplay/coreData/associationMaps";

type SimpleShipConstructionDurationData =
{
    divider: number;
};

const SHIP_CONSTRUCTION_GENERIC_DATA: SimpleShipConstructionDurationData =
{
    divider: 2500,
};

export function computeConstructionDurationSeconds(shipType: number, currentShipyardLevel: number, serverData: ServerDataType.ServerData | null): number | null
{
    const shipStats: AssociationMaps.ShipStats | undefined = AssociationMaps.SHIP_STATS.get(shipType);
    if (shipStats === undefined)
    {
        return null;
    }
    return computeConstructionDurationSeconds_SimpleShip(currentShipyardLevel, shipStats.maxHealth, SHIP_CONSTRUCTION_GENERIC_DATA, serverData);
}

function computeConstructionDurationSeconds_SimpleShip(currentShipyardLevel: number, maxHealth: number, data: SimpleShipConstructionDurationData, serverData: ServerDataType.ServerData | null): number
{
    const timeMultiplier: number = serverData ? serverData.config.time_multiplier : 1;
    const durationHours: number = maxHealth / (data.divider * (currentShipyardLevel + 1));
    return Math.floor(durationHours * 3600 / timeMultiplier);
}
