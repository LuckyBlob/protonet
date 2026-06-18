import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as GameType from "@/lib/gameplay/coreData/type/gameTypes"
import * as StaticData from "@/lib/gameplay/coreData/static/staticData";
import * as StaticDataHelper from "@/lib/gameplay/coreData/static/staticDataHelpers";

type SimpleShipConstructionDurationData =
{
    divider: number;
};

const SHIP_CONSTRUCTION_GENERIC_DATA: SimpleShipConstructionDurationData =
{
    divider: 2500,
};

// Each Nanite Factory level cumulatively divides construction time by this factor (halving by default).
const NANITE_FACTORY_DURATION_DIVIDER_PER_LEVEL: number = 2;

export function computeConstructionDurationSeconds(shipType: GameType.ShipType, currentShipyardLevel: number, naniteFactoryLevel: number, serverData: CoreType.ServerData | null): number | null
{
    const shipStats: GameType.ShipStats | undefined = StaticDataHelper.getShipStats(shipType);
    if (shipStats === undefined)
    {
        return null;
    }
    return computeConstructionDurationSeconds_SimpleShip(currentShipyardLevel, shipStats.maxHealth, naniteFactoryLevel, SHIP_CONSTRUCTION_GENERIC_DATA, serverData);
}

function computeConstructionDurationSeconds_SimpleShip(currentShipyardLevel: number, maxHealth: number, naniteFactoryLevel: number, data: SimpleShipConstructionDurationData, serverData: CoreType.ServerData | null): number
{
    const timeMultiplier: number = serverData !== null ? serverData.config.time_multiplier : 1;
    const naniteFactoryDurationDivider: number = Math.pow(NANITE_FACTORY_DURATION_DIVIDER_PER_LEVEL, naniteFactoryLevel);
    const durationHours: number = maxHealth / (data.divider * (currentShipyardLevel + 1) * naniteFactoryDurationDivider);
    return durationHours * 3600 / timeMultiplier;
}
