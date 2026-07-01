// Per-building energy throttle accessor. The setting is a percentage in [0, 100] (10% steps)
// that scales a building's energy planet value production/consumption AND its resource production.
// A building absent from the buildingEnergySettings map runs at full power (100%). The setting is
// only meaningful for buildings that contribute to the Energy planet value (see buildingHasEnergyPlanetValue).
import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as StaticDataHelper from "@/lib/gameplay/coreData/static/staticDataHelpers";

export const FULL_ENERGY_PERCENTAGE: number = 100;
export const ENERGY_PERCENTAGE_STEP: number = 10;

export function getBuildingEnergyPercentage(planetData: CoreType.PlanetData, buildingType: GameType.BuildingType): number
{
    return planetData.dynamicPlanetData.buildingEnergySettings.get(buildingType) ?? FULL_ENERGY_PERCENTAGE;
}

export function getBuildingEnergyFactor(planetData: CoreType.PlanetData, buildingType: GameType.BuildingType): number
{
    return getBuildingEnergyPercentage(planetData, buildingType) / 100;
}

export function setBuildingEnergyPercentage(planetData: CoreType.PlanetData, buildingType: GameType.BuildingType, energyPercentage: number): void
{
    planetData.dynamicPlanetData.buildingEnergySettings.set(buildingType, energyPercentage);
}

export function isValidEnergyPercentage(energyPercentage: number): boolean
{
    if (Number.isInteger(energyPercentage) === false)
    {
        return false;
    }

    if (energyPercentage < 0 || energyPercentage > FULL_ENERGY_PERCENTAGE)
    {
        return false;
    }

    return energyPercentage % ENERGY_PERCENTAGE_STEP === 0;
}

// A building can be throttled only if it produces or consumes Energy. Storage / pure-utility
// buildings have no energy contribution and so never show the throttle control.
export function buildingHasEnergyPlanetValue(buildingType: GameType.BuildingType): boolean
{
    const buildingStats: GameType.BuildingStats = StaticDataHelper.getBuildingStats(buildingType);

    if (buildingStats.planetValueStats === undefined)
    {
        return false;
    }

    return buildingStats.planetValueStats.some((planetValueStat: GameType.PlanetValueStat): boolean =>
        planetValueStat.planetValueType === GameType.PlanetValueType.Energy);
}
