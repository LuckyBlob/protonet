import * as DBTypes from "@/lib/db/dbTypes";
import * as Association from "@/lib/gameplay/associations";

export const PRODUCTION_BUILDING_UPGRADE_COST_GROWTH_FACTOR: number = 1.5;
export const BASE_RESSOURCE_1_PRODUCTION_BUILDING_COST: number = 60;

export function computeUpgradeCost(currentUpgradeLevel: number, buildingType: number): number | null
{
    const baseRessourceProductionCost: number | null = Association.getBaseProductionBuildingCostForBuilding(buildingType);
    if (baseRessourceProductionCost === null)
    {
        return null;
    }

    return Math.floor(baseRessourceProductionCost * Math.pow(PRODUCTION_BUILDING_UPGRADE_COST_GROWTH_FACTOR, currentUpgradeLevel));
}

export function canAffordUpgrade(planetRow: DBTypes.PlanetRow, buildingType: number): boolean
{
    const currentUpgradeLevel: number | null = Association.getProductionBuildingLevelForBuilding(planetRow, buildingType);
    if (currentUpgradeLevel === null)
    {
        return false;
    }
    
    const nextUpgradeCost: number | null = computeUpgradeCost(currentUpgradeLevel, buildingType);
    if (nextUpgradeCost === null)
    {
        return false;
    }

    const ressourceQuantity: number | null = Association.getRessourceQuantityForProductionBuildingType(planetRow, buildingType);
    if (ressourceQuantity === null)
    {
        return false;
    }

    return ressourceQuantity >= nextUpgradeCost;
}