import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as DBType from "@/lib/db/dbTypes";
import * as BuildingCost from "@/lib/gameplay/coreData/formula/buildingCostFormulas";
import * as ResearchCost from "@/lib/gameplay/coreData/formula/researchCostFormulas";
import * as StaticDataHelper from "@/lib/gameplay/coreData/static/staticDataHelpers";

const INVESTED_VALUE_PER_SCORE_POINT: number = 1000;

//#region leaf cost helpers
function sumResourceQuantities(resourceQuantities: Map<GameType.ResourceType, number>): number
{
    let total: number = 0;
    for (const resourceQuantity of resourceQuantities.values())
    {
        total += resourceQuantity;
    }

    return total;
}

export function computeBuildingLevelInvestedValue(buildingType: GameType.BuildingType, fromLevel: number): number
{
    const levelCost: Map<GameType.ResourceType, number> | null = BuildingCost.computeBuildingUpgradeCost(fromLevel, buildingType);
    if (levelCost === null)
    {
        return 0;
    }

    return sumResourceQuantities(levelCost);
}

export function computeBuildingCumulativeInvestedValue(buildingType: GameType.BuildingType, level: number): number
{
    let total: number = 0;
    for (let fromLevel: number = 0; fromLevel < level; fromLevel++)
    {
        total += computeBuildingLevelInvestedValue(buildingType, fromLevel);
    }

    return total;
}

export function computeResearchLevelInvestedValue(researchType: GameType.ResearchType, fromLevel: number): number
{
    const levelCost: Map<GameType.ResourceType, number> | null = ResearchCost.computeResearchUpgradeCost(fromLevel, researchType);
    if (levelCost === null)
    {
        return 0;
    }

    return sumResourceQuantities(levelCost);
}

export function computeResearchCumulativeInvestedValue(researchType: GameType.ResearchType, level: number): number
{
    let total: number = 0;
    for (let fromLevel: number = 0; fromLevel < level; fromLevel++)
    {
        total += computeResearchLevelInvestedValue(researchType, fromLevel);
    }

    return total;
}

export function computeUnitInvestedValue(unitType: GameType.UnitType, unitQuantity: number): number
{
    const unitStats: GameType.UnitStats = StaticDataHelper.getUnitStats(unitType);
    return sumResourceQuantities(unitStats.costMap) * unitQuantity;
}
//#endregion

//#region per-player aggregation
function computePlanetBuildingsInvestedValue(planetData: CoreType.PlanetData): number
{
    let total: number = 0;
    const buildingLevels: Map<GameType.BuildingType, number> = planetData.dynamicPlanetData.buildingLevels;

    for (const [buildingType, buildingLevel] of buildingLevels)
    {
        total += computeBuildingCumulativeInvestedValue(buildingType, buildingLevel);
    }

    for (const buildingUpgrade of planetData.dynamicPlanetData.buildingUpgrades)
    {
        for (const buildingUpgradeBuildingRow of buildingUpgrade.buildingUpgradeBuildingRows)
        {
            const upgradedBuildingType: GameType.BuildingType = buildingUpgradeBuildingRow.building_type as GameType.BuildingType;
            const levelBeforeUpgrade: number = buildingLevels.get(upgradedBuildingType) ?? 0;
            total += computeBuildingLevelInvestedValue(upgradedBuildingType, levelBeforeUpgrade);
        }
    }

    for (const buildingDeconstruction of planetData.dynamicPlanetData.buildingDeconstructions)
    {
        for (const buildingDeconstructionBuildingRow of buildingDeconstruction.buildingDeconstructionBuildingRows)
        {
            const deconstructedBuildingType: GameType.BuildingType = buildingDeconstructionBuildingRow.building_type as GameType.BuildingType;
            const levelBeforeDeconstruction: number = buildingLevels.get(deconstructedBuildingType) ?? 0;
            if (levelBeforeDeconstruction < 1)
            {
                continue;
            }

            total -= computeBuildingLevelInvestedValue(deconstructedBuildingType, levelBeforeDeconstruction - 1);
        }
    }

    return total;
}

function computePlanetUnitsInvestedValue(planetData: CoreType.PlanetData): number
{
    let total: number = 0;

    for (const [unitType, unitQuantity] of planetData.dynamicPlanetData.unitQuantity)
    {
        total += computeUnitInvestedValue(unitType, unitQuantity);
    }

    for (const unitConstruction of planetData.dynamicPlanetData.unitConstructions)
    {
        for (const unitConstructionUnitRow of unitConstruction.unitConstructionUnitRows)
        {
            total += computeUnitInvestedValue(unitConstructionUnitRow.unit_type as GameType.UnitType, unitConstructionUnitRow.unit_quantity);
        }
    }

    return total;
}

function computeInFlightUnitsInvestedValue(playerData: CoreType.PlayerData): number
{
    let total: number = 0;
    const countedFleetIds: Set<number> = new Set<number>();

    for (const planetData of playerData.planetDatas)
    {
        for (const fleetMovement of planetData.dynamicPlanetData.futureFleetArrivals)
        {
            if (fleetMovement.fleetMovementRow.player_origin_id !== playerData.playerRow.id)
            {
                continue;
            }

            if (countedFleetIds.has(fleetMovement.fleetMovementRow.id) === true)
            {
                continue;
            }
            countedFleetIds.add(fleetMovement.fleetMovementRow.id);

            for (const fleetMovementUnitRow of fleetMovement.fleetMovementUnitRows)
            {
                total += computeUnitInvestedValue(fleetMovementUnitRow.unit_type as GameType.UnitType, fleetMovementUnitRow.unit_quantity);
            }
        }
    }

    return total;
}

function computeResearchInvestedValue(playerData: CoreType.PlayerData): number
{
    let total: number = 0;
    const researchLevels: Map<GameType.ResearchType, number> = playerData.dynamicPlayerData.researchLevels;

    for (const [researchType, researchLevel] of researchLevels)
    {
        total += computeResearchCumulativeInvestedValue(researchType, researchLevel);
    }

    for (const currentlyResearching of playerData.dynamicPlayerData.currentlyResearchings)
    {
        for (const currentlyResearchingResearchRow of currentlyResearching.currentlyResearchingResearchRows)
        {
            const researchedType: GameType.ResearchType = currentlyResearchingResearchRow.research_type as GameType.ResearchType;
            const levelBeforeResearch: number = researchLevels.get(researchedType) ?? 0;
            total += computeResearchLevelInvestedValue(researchedType, levelBeforeResearch);
        }
    }

    return total;
}

export function computePlayerInvestedValue(playerData: CoreType.PlayerData): number
{
    let total: number = 0;

    for (const planetData of playerData.planetDatas)
    {
        total += computePlanetBuildingsInvestedValue(planetData);
        total += computePlanetUnitsInvestedValue(planetData);
    }

    total += computeInFlightUnitsInvestedValue(playerData);
    total += computeResearchInvestedValue(playerData);

    return total;
}
//#endregion

//#region score derivation
export function computeScoreFromInvestedValue(investedValue: number): number
{
    return Math.floor(investedValue / INVESTED_VALUE_PER_SCORE_POINT);
}

export function getPublicPlayerScore(publicPlayerRows: DBType.PublicPlayerRow[], playerId: number): number
{
    const publicPlayerRow: DBType.PublicPlayerRow | undefined = publicPlayerRows.find((row: DBType.PublicPlayerRow): boolean => row.id === playerId);
    if (publicPlayerRow === undefined)
    {
        throw new Error(`No public player row for playerId ${playerId} when reading score.`);
    }

    return publicPlayerRow.score;
}
//#endregion
