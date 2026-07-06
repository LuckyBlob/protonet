import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as GameType from "@/lib/gameplay/coreData/type/gameTypes"
import * as StaticData from "@/lib/gameplay/coreData/static/staticData";
import * as StaticDataHelper from "@/lib/gameplay/coreData/static/staticDataHelpers";

type SimpleUnitConstructionDurationData =
{
    divider: number;
};

const UNIT_CONSTRUCTION_GENERIC_DATA: SimpleUnitConstructionDurationData =
{
    divider: 2500,
};

const NANITE_FACTORY_DURATION_DIVIDER_PER_LEVEL: number = 2;

export function computeConstructionDurationSeconds(unitType: GameType.UnitType, currentShipyardLevel: number, naniteFactoryLevel: number, serverData: CoreType.ServerData | null): number | null
{
    const unitStats: GameType.UnitStats = StaticDataHelper.getUnitStats(unitType);
    return computeConstructionDurationSeconds_SimpleUnit(currentShipyardLevel, unitStats.maxHealth, naniteFactoryLevel, UNIT_CONSTRUCTION_GENERIC_DATA, serverData);
}

function computeConstructionDurationSeconds_SimpleUnit(currentShipyardLevel: number, maxHealth: number, naniteFactoryLevel: number, data: SimpleUnitConstructionDurationData, serverData: CoreType.ServerData | null): number
{
    const timeMultiplier: number = serverData !== null ? serverData.config.time_multiplier : 1;
    const naniteFactoryDurationDivider: number = Math.pow(NANITE_FACTORY_DURATION_DIVIDER_PER_LEVEL, naniteFactoryLevel);
    const durationHours: number = maxHealth / (data.divider * (currentShipyardLevel + 1) * naniteFactoryDurationDivider);
    return durationHours * 3600 / timeMultiplier;
}
