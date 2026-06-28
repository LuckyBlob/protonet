import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as CalculatedValueData from "@/lib/gameplay/dynamicData/calculatedValueData";
import * as StaticDataHelper from "@/lib/gameplay/coreData/static/staticDataHelpers";

export function getUnitMissileSpaceCost(unitType: GameType.UnitType): number
{
    const unitPlanetValueStats: GameType.UnitPlanetValueStats[] | undefined = StaticDataHelper.getUnitStats(unitType).unitPlanetValueStats;
    if (unitPlanetValueStats === undefined)
    {
        return 0;
    }

    let missileSpaceCost: number = 0;
    for (const singleUnitPlanetValueStats of unitPlanetValueStats)
    {
        const missileSpaceFactor: number | undefined = singleUnitPlanetValueStats.basePlanetValueFactor.get(GameType.PlanetValueType.MissileSpace);
        if (missileSpaceFactor !== undefined && missileSpaceFactor < 0)
        {
            missileSpaceCost += Math.abs(missileSpaceFactor);
        }
    }

    return missileSpaceCost;
}

function computeQueuedMissileSpace(planetData: CoreType.PlanetData): number
{
    let queuedMissileSpace: number = 0;
    for (const unitConstruction of planetData.dynamicPlanetData.unitConstructions)
    {
        for (const unitConstructionUnitRow of unitConstruction.unitConstructionUnitRows)
        {
            queuedMissileSpace += getUnitMissileSpaceCost(unitConstructionUnitRow.unit_type as GameType.UnitType) * unitConstructionUnitRow.unit_quantity;
        }
    }

    return queuedMissileSpace;
}

export function computeMissileSpaceCapacity(planetData: CoreType.PlanetData, playerData: CoreType.PlayerData): number
{
    const missileSpaceValueData: CoreType.CalculatedValueData | null = CalculatedValueData.computePlanetValueData(planetData, GameType.PlanetValueType.MissileSpace, playerData);
    return missileSpaceValueData === null ? 0 : missileSpaceValueData.production;
}

export function computeUsedMissileSpace(planetData: CoreType.PlanetData, playerData: CoreType.PlayerData): number
{
    const missileSpaceValueData: CoreType.CalculatedValueData | null = CalculatedValueData.computePlanetValueData(planetData, GameType.PlanetValueType.MissileSpace, playerData);
    const ownedMissileSpace: number = missileSpaceValueData === null ? 0 : missileSpaceValueData.consumption;
    return ownedMissileSpace + computeQueuedMissileSpace(planetData);
}

export function computeFreeMissileSpace(planetData: CoreType.PlanetData, playerData: CoreType.PlayerData): number
{
    return Math.max(0, computeMissileSpaceCapacity(planetData, playerData) - computeUsedMissileSpace(planetData, playerData));
}

export function computeMaxStorableMissileQuantities(planetData: CoreType.PlanetData, playerData: CoreType.PlayerData, unitQuantities: Map<GameType.UnitType, number>): Map<GameType.UnitType, number>
{
    const storableUnitQuantities: Map<GameType.UnitType, number> = new Map<GameType.UnitType, number>();
    let remainingFreeMissileSpace: number = computeFreeMissileSpace(planetData, playerData);

    for (const [unitType, desiredUnitQuantity] of unitQuantities)
    {
        const missileSpaceCost: number = getUnitMissileSpaceCost(unitType);
        if (missileSpaceCost <= 0)
        {
            continue;
        }

        const storableQuantity: number = Math.min(desiredUnitQuantity, Math.floor(remainingFreeMissileSpace / missileSpaceCost));
        if (storableQuantity <= 0)
        {
            continue;
        }

        storableUnitQuantities.set(unitType, storableQuantity);
        remainingFreeMissileSpace -= storableQuantity * missileSpaceCost;
    }

    return storableUnitQuantities;
}
