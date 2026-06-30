import { describe, it, expect } from 'vitest';
import * as CombatResearch from '@/lib/gameplay/coreData/formula/combatResearchFunctions';
import * as GameType from '@/lib/gameplay/coreData/type/gameTypes';
import * as CoreType from '@/lib/gameplay/coreData/type/coreTypes';
import * as ResearchData from '@/lib/gameplay/dynamicData/player/researchData';
import * as StaticDataHelper from '@/lib/gameplay/coreData/static/staticDataHelpers';
import * as TestDataBuilders from '../helpers/testDataBuilders';

function buildPlayerWithResearch(researchLevels: [GameType.ResearchType, number][]): CoreType.PlayerData
{
    const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData();
    for (const [researchType, researchLevel] of researchLevels)
    {
        ResearchData.setResearchLevel(playerData, researchType, researchLevel);
    }

    return playerData;
}

const SMALL_TRANSPORT_STATS: GameType.UnitStats = StaticDataHelper.getUnitStats(GameType.UnitType.SmallTransport);
const ROCKET_LAUNCHER_STATS: GameType.UnitStats = StaticDataHelper.getUnitStats(GameType.UnitType.RocketLauncher);

describe('combat research augmentation', () =>
{
    it('returns the unit base stats when the player has no research', () =>
    {
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData();
        expect(CombatResearch.computeUnitWeaponPower(playerData, SMALL_TRANSPORT_STATS)).toBe(SMALL_TRANSPORT_STATS.weaponPower);
        expect(CombatResearch.computeUnitShieldPower(playerData, SMALL_TRANSPORT_STATS)).toBe(SMALL_TRANSPORT_STATS.shieldPower);
        expect(CombatResearch.computeUnitArmour(playerData, SMALL_TRANSPORT_STATS)).toBe(SMALL_TRANSPORT_STATS.maxHealth);
    });

    it('adds 10% of the base weapon power per Weapons Technology level', () =>
    {
        const playerData: CoreType.PlayerData = buildPlayerWithResearch([[GameType.ResearchType.WeaponTech, 5]]);
        expect(CombatResearch.computeUnitWeaponPower(playerData, ROCKET_LAUNCHER_STATS)).toBe(ROCKET_LAUNCHER_STATS.weaponPower * (1 + 0.10 * 5));
    });

    it('adds 10% of the base shield power per Shielding Technology level', () =>
    {
        const playerData: CoreType.PlayerData = buildPlayerWithResearch([[GameType.ResearchType.ShieldingTech, 3]]);
        expect(CombatResearch.computeUnitShieldPower(playerData, ROCKET_LAUNCHER_STATS)).toBe(ROCKET_LAUNCHER_STATS.shieldPower * (1 + 0.10 * 3));
    });

    it('adds 10% of the base hull plating per Armour Technology level', () =>
    {
        const playerData: CoreType.PlayerData = buildPlayerWithResearch([[GameType.ResearchType.ArmourTech, 4]]);
        expect(CombatResearch.computeUnitArmour(playerData, SMALL_TRANSPORT_STATS)).toBe(SMALL_TRANSPORT_STATS.maxHealth * (1 + 0.10 * 4));
    });

    it('augments each stat only from its own combat research', () =>
    {
        const playerData: CoreType.PlayerData = buildPlayerWithResearch([
            [GameType.ResearchType.WeaponTech, 2],
            [GameType.ResearchType.ShieldingTech, 7],
            [GameType.ResearchType.ArmourTech, 1]]);
        expect(CombatResearch.computeUnitWeaponPower(playerData, ROCKET_LAUNCHER_STATS)).toBe(ROCKET_LAUNCHER_STATS.weaponPower * (1 + 0.10 * 2));
        expect(CombatResearch.computeUnitShieldPower(playerData, ROCKET_LAUNCHER_STATS)).toBe(ROCKET_LAUNCHER_STATS.shieldPower * (1 + 0.10 * 7));
        expect(CombatResearch.computeUnitArmour(playerData, ROCKET_LAUNCHER_STATS)).toBe(ROCKET_LAUNCHER_STATS.maxHealth * (1 + 0.10 * 1));
    });
});
