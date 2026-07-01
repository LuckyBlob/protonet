import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as StaticDataHelper from "@/lib/gameplay/coreData/static/staticDataHelpers";
import * as CombatResearch from "@/lib/gameplay/coreData/formula/combatResearchFunctions";
import * as MathHelp from "@/lib/helper/mathHelp";

export const COMBAT_ROUND_COUNT: number = 6;

const SHIELD_BOUNCE_THRESHOLD_FRACTION: number = 0.01;
const HULL_EXPLOSION_THRESHOLD_FRACTION: number = 0.70;

export type CombatResult =
{
    attackerUnitQuantities: Map<GameType.UnitType, number>;
    defenderUnitQuantities: Map<GameType.UnitType, number>;
    numRounds: number;
};

type CombatUnitProfile =
{
    weaponPower: number;
    maxShieldPower: number;
    maxHullPlating: number;
    rapidFire: Map<GameType.UnitType, number>;
};

type CombatFleet =
{
    unitQuantities: Map<GameType.UnitType, number>;
    unitProfiles: Map<GameType.UnitType, CombatUnitProfile>;
};

type CombatUnit =
{
    unitType: GameType.UnitType;
    hullPlating: number;
    shieldPoints: number;
};

type CombatSide =
{
    units: CombatUnit[];
    totalUnitCount: number;
    destroyedUnitCount: number;
};

export function resolveCombat(attackerPlayerData: CoreType.PlayerData, defenderPlayerData: CoreType.PlayerData, attackerUnitQuantities: Map<GameType.UnitType, number>, defenderUnitQuantities: Map<GameType.UnitType, number>, seed: number): CombatResult
{
    const attackerFleet: CombatFleet = buildCombatFleet(attackerPlayerData, attackerUnitQuantities);
    const defenderFleet: CombatFleet = buildCombatFleet(defenderPlayerData, defenderUnitQuantities);

    return fightBattle(attackerFleet, defenderFleet, seed);
}

function fightBattle(attackerFleetProfile: CombatFleet, defenderFleetProfile: CombatFleet, seed: number): CombatResult
{
    const rollNextRandom: () => number = MathHelp.createSeededRandomStream(seed);

    const attackerSide: CombatSide = deployFleetAsIndividualUnits(attackerFleetProfile);
    const defenderSide: CombatSide = deployFleetAsIndividualUnits(defenderFleetProfile);

    let roundsFought: number = 0;
    while (roundsFought < COMBAT_ROUND_COUNT && bothSidesStillHaveUnits(attackerSide, defenderSide))
    {
        roundsFought += 1;

        rechargeAllShields(attackerSide, attackerFleetProfile);
        rechargeAllShields(defenderSide, defenderFleetProfile);

        fireEveryUnitAtEnemy(attackerSide, defenderSide, attackerFleetProfile, defenderFleetProfile, rollNextRandom);
        fireEveryUnitAtEnemy(defenderSide, attackerSide, defenderFleetProfile, attackerFleetProfile, rollNextRandom);

        clearExplodedWreckage(attackerSide);
        clearExplodedWreckage(defenderSide);
    }

    const combatResult: CombatResult =
    {
        attackerUnitQuantities: tallySurvivorsByType(attackerSide),
        defenderUnitQuantities: tallySurvivorsByType(defenderSide),
        numRounds: roundsFought,
    };

    return combatResult;
}

function buildCombatFleet(playerData: CoreType.PlayerData, unitQuantities: Map<GameType.UnitType, number>): CombatFleet
{
    const unitProfiles: Map<GameType.UnitType, CombatUnitProfile> = new Map<GameType.UnitType, CombatUnitProfile>();

    for (const unitType of unitQuantities.keys())
    {
        unitProfiles.set(unitType, buildCombatUnitProfile(playerData, unitType));
    }

    const combatFleet: CombatFleet =
    {
        unitQuantities: unitQuantities,
        unitProfiles: unitProfiles,
    };

    return combatFleet;
}

function buildCombatUnitProfile(playerData: CoreType.PlayerData, unitType: GameType.UnitType): CombatUnitProfile
{
    const unitStats: GameType.UnitStats = StaticDataHelper.getUnitStats(unitType);

    const combatUnitProfile: CombatUnitProfile =
    {
        weaponPower: CombatResearch.computeUnitWeaponPower(playerData, unitStats),
        maxShieldPower: CombatResearch.computeUnitShieldPower(playerData, unitStats),
        maxHullPlating: CombatResearch.computeUnitArmour(playerData, unitStats),
        rapidFire: unitStats.rapidFire ?? new Map<GameType.UnitType, number>(),
    };

    return combatUnitProfile;
}

function bothSidesStillHaveUnits(attackerSide: CombatSide, defenderSide: CombatSide): boolean
{
    return hasLivingUnit(attackerSide) && hasLivingUnit(defenderSide);
}

function hasLivingUnit(side: CombatSide): boolean
{
    return side.destroyedUnitCount < side.totalUnitCount;
}

function deployFleetAsIndividualUnits(fleet: CombatFleet): CombatSide
{
    const combatUnits: CombatUnit[] = [];

    for (const [unitType, unitQuantity] of fleet.unitQuantities)
    {
        if (unitQuantity <= 0)
        {
            continue;
        }

        const unitProfile: CombatUnitProfile = getUnitProfile(fleet, unitType);

        for (let unitIndex: number = 0; unitIndex < unitQuantity; unitIndex += 1)
        {
            const combatUnit: CombatUnit =
            {
                unitType: unitType,
                hullPlating: unitProfile.maxHullPlating,
                shieldPoints: unitProfile.maxShieldPower,
            };
            combatUnits.push(combatUnit);
        }
    }

    const combatSide: CombatSide =
    {
        units: combatUnits,
        totalUnitCount: combatUnits.length,
        destroyedUnitCount: 0,
    };

    return combatSide;
}

function rechargeAllShields(side: CombatSide, fleetProfile: CombatFleet): void
{
    for (const combatUnit of side.units)
    {
        combatUnit.shieldPoints = getUnitProfile(fleetProfile, combatUnit.unitType).maxShieldPower;
    }
}

function fireEveryUnitAtEnemy(shooterSide: CombatSide, enemySide: CombatSide, shooterFleetProfile: CombatFleet, enemyFleetProfile: CombatFleet, rollNextRandom: () => number): void
{
    for (const shooter of shooterSide.units)
    {
        if (hasLivingUnit(enemySide) === false)
        {
            return;
        }

        fireVolley(shooter, enemySide, shooterFleetProfile, enemyFleetProfile, rollNextRandom);
    }
}

function fireVolley(shooter: CombatUnit, enemySide: CombatSide, shooterFleetProfile: CombatFleet, enemyFleetProfile: CombatFleet, rollNextRandom: () => number): void
{
    const shooterProfile: CombatUnitProfile = getUnitProfile(shooterFleetProfile, shooter.unitType);

    let shooterKeepsFiring: boolean = true;
    while (shooterKeepsFiring && hasLivingUnit(enemySide))
    {
        const target: CombatUnit = pickRandomTarget(enemySide.units, rollNextRandom);
        const targetProfile: CombatUnitProfile = getUnitProfile(enemyFleetProfile, target.unitType);

        const targetDestroyed: boolean = fireSingleShot(shooterProfile, target, targetProfile, rollNextRandom);
        if (targetDestroyed === true)
        {
            enemySide.destroyedUnitCount += 1;
        }

        shooterKeepsFiring = rollRapidFireContinuation(shooterProfile, target.unitType, rollNextRandom);
    }
}

function pickRandomTarget(enemyUnits: CombatUnit[], rollNextRandom: () => number): CombatUnit
{
    const targetIndex: number = Math.floor(rollNextRandom() * enemyUnits.length);
    return enemyUnits[targetIndex];
}

function fireSingleShot(shooterProfile: CombatUnitProfile, target: CombatUnit, targetProfile: CombatUnitProfile, rollNextRandom: () => number): boolean
{
    if (target.hullPlating <= 0)
    {
        return false;
    }

    if (isShotBouncedOffShield(shooterProfile.weaponPower, target.shieldPoints) === true)
    {
        return false;
    }

    const shieldAbsorbedDamage: number = Math.min(shooterProfile.weaponPower, target.shieldPoints);
    target.shieldPoints -= shieldAbsorbedDamage;

    const hullDamage: number = shooterProfile.weaponPower - shieldAbsorbedDamage;
    target.hullPlating -= hullDamage;

    applyExplosionChance(target, targetProfile, rollNextRandom);

    return target.hullPlating <= 0;
}

function isShotBouncedOffShield(weaponPower: number, shieldPoints: number): boolean
{
    return weaponPower < SHIELD_BOUNCE_THRESHOLD_FRACTION * shieldPoints;
}

function applyExplosionChance(target: CombatUnit, targetProfile: CombatUnitProfile, rollNextRandom: () => number): void
{
    if (target.hullPlating <= 0)
    {
        return;
    }

    const explosionHullThreshold: number = HULL_EXPLOSION_THRESHOLD_FRACTION * targetProfile.maxHullPlating;
    if (target.hullPlating >= explosionHullThreshold)
    {
        return;
    }

    const explosionChance: number = 1 - target.hullPlating / targetProfile.maxHullPlating;
    if (rollNextRandom() < explosionChance)
    {
        target.hullPlating = 0;
    }
}

function rollRapidFireContinuation(shooterProfile: CombatUnitProfile, targetUnitType: GameType.UnitType, rollNextRandom: () => number): boolean
{
    const rapidFireValue: number | undefined = shooterProfile.rapidFire.get(targetUnitType);
    if (rapidFireValue === undefined || rapidFireValue <= 1)
    {
        return false;
    }

    const continuationChance: number = (rapidFireValue - 1) / rapidFireValue;
    return rollNextRandom() < continuationChance;
}

function clearExplodedWreckage(side: CombatSide): void
{
    side.units = side.units.filter((combatUnit: CombatUnit): boolean => combatUnit.hullPlating > 0);
}

function tallySurvivorsByType(side: CombatSide): Map<GameType.UnitType, number>
{
    const survivorQuantities: Map<GameType.UnitType, number> = new Map<GameType.UnitType, number>();

    for (const combatUnit of side.units)
    {
        const currentSurvivorCount: number = survivorQuantities.get(combatUnit.unitType) ?? 0;
        survivorQuantities.set(combatUnit.unitType, currentSurvivorCount + 1);
    }

    return survivorQuantities;
}

function getUnitProfile(fleet: CombatFleet, unitType: GameType.UnitType): CombatUnitProfile
{
    const unitProfile: CombatUnitProfile | undefined = fleet.unitProfiles.get(unitType);
    if (unitProfile === undefined)
    {
        throw new Error(`resolveCombat has no combat profile for unit type ${unitType}.`);
    }

    return unitProfile;
}
