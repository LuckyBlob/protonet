import { describe, it, expect } from 'vitest';
import * as ShipSpeed from '@/lib/gameplay/coreData/formula/shipSpeedFormulas';
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

function getShipSpeedDatas(shipType: GameType.ShipType): GameType.EngineTechData<number>[]
{
    const shipStats: GameType.ShipStats | undefined = StaticDataHelper.getShipStats(shipType);
    if (shipStats === undefined)
    {
        throw new Error(`No ship stats for ship type ${shipType}.`);
    }

    return shipStats.speed;
}

// Mirrors a Small Transport: a Combustion base tier and an Impulse tier that unlocks at Impulse level 5.
const SMALL_TRANSPORT_SPEED: GameType.EngineTechData<number>[] =
[
    { engineTech: GameType.ResearchType.CombustionDrive, researchLevel: 0, value: 5000 },
    { engineTech: GameType.ResearchType.ImpulseDrive, researchLevel: 5, value: 10000 },
];

// A hypothetical ship with a Hyperspace tier, to exercise the +30%/level bonus.
const HYPERSPACE_SHIP_SPEED: GameType.EngineTechData<number>[] =
[
    { engineTech: GameType.ResearchType.CombustionDrive, researchLevel: 0, value: 1000 },
    { engineTech: GameType.ResearchType.HyperspaceDrive, researchLevel: 1, value: 2000 },
];

describe('computeShipSpeed', () =>
{
    it('returns the base tier speed when the player has no research', () =>
    {
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData();
        expect(ShipSpeed.computeShipSpeed(playerData, SMALL_TRANSPORT_SPEED)).toBe(5000);
    });

    it('adds 10% per Combustion Drive level while on the Combustion tier', () =>
    {
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData();
        ResearchData.setResearchLevel(playerData, GameType.ResearchType.CombustionDrive, 3);
        // 5000 * (1 + 0.10 * 3) = 6500
        expect(ShipSpeed.computeShipSpeed(playerData, SMALL_TRANSPORT_SPEED)).toBe(6500);
    });

    it('stays on the Combustion tier until Impulse Drive reaches the unlock level', () =>
    {
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData();
        ResearchData.setResearchLevel(playerData, GameType.ResearchType.CombustionDrive, 4);
        ResearchData.setResearchLevel(playerData, GameType.ResearchType.ImpulseDrive, 4);
        // Impulse 4 < 5, so still Combustion: 5000 * (1 + 0.10 * 4) = 7000
        expect(ShipSpeed.computeShipSpeed(playerData, SMALL_TRANSPORT_SPEED)).toBe(7000);
    });

    it('switches to the Impulse tier and its 20%/level bonus once Impulse Drive unlocks it', () =>
    {
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData();
        ResearchData.setResearchLevel(playerData, GameType.ResearchType.ImpulseDrive, 5);
        // 10000 * (1 + 0.20 * 5) = 20000
        expect(ShipSpeed.computeShipSpeed(playerData, SMALL_TRANSPORT_SPEED)).toBe(20000);
    });

    it('applies the bonus of the active engine only, ignoring the other engine levels', () =>
    {
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData();
        ResearchData.setResearchLevel(playerData, GameType.ResearchType.CombustionDrive, 9);
        ResearchData.setResearchLevel(playerData, GameType.ResearchType.ImpulseDrive, 5);
        // Now on the Impulse tier, so the Combustion level 9 is irrelevant: 10000 * (1 + 0.20 * 5) = 20000
        expect(ShipSpeed.computeShipSpeed(playerData, SMALL_TRANSPORT_SPEED)).toBe(20000);
    });

    it('adds 30% per Hyperspace Drive level while on the Hyperspace tier', () =>
    {
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData();
        ResearchData.setResearchLevel(playerData, GameType.ResearchType.HyperspaceDrive, 2);
        // 2000 * (1 + 0.30 * 2) = 3200
        expect(ShipSpeed.computeShipSpeed(playerData, HYPERSPACE_SHIP_SPEED)).toBe(3200);
    });

    it('returns undefined when no tier matches the player research', () =>
    {
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData();
        const noBaseTier: GameType.EngineTechData<number>[] =
        [
            { engineTech: GameType.ResearchType.ImpulseDrive, researchLevel: 5, value: 10000 },
        ];
        expect(ShipSpeed.computeShipSpeed(playerData, noBaseTier)).toBeUndefined();
    });
});

describe('engine tech speed bonuses on the real ships', () =>
{
    // Base speeds from staticData: Small Transport 5000 (Combustion, Impulse tier at 5),
    // Large Transport 7500 (Combustion only), Colony Ship 2500 (Impulse only). No ship has a
    // Hyperspace engine, so Hyperspace Drive must never change any current ship's speed.

    describe('Combustion Drive (+10% per level) applies only to Combustion-engine ships', () =>
    {
        it('boosts the Large Transport (a pure Combustion ship)', () =>
        {
            const playerData: CoreType.PlayerData = buildPlayerWithResearch([[GameType.ResearchType.CombustionDrive, 4]]);
            // 7500 * (1 + 0.10 * 4) = 10500
            expect(ShipSpeed.computeShipSpeed(playerData, getShipSpeedDatas(GameType.ShipType.LargeTransport))).toBe(10500);
        });

        it('boosts the Small Transport while it is still on its Combustion tier', () =>
        {
            const playerData: CoreType.PlayerData = buildPlayerWithResearch([[GameType.ResearchType.CombustionDrive, 5]]);
            // Impulse is 0 (< 5), so still Combustion: 5000 * (1 + 0.10 * 5) = 7500
            expect(ShipSpeed.computeShipSpeed(playerData, getShipSpeedDatas(GameType.ShipType.SmallTransport))).toBe(7500);
        });

        it('does NOT boost the Colony Ship (a pure Impulse ship)', () =>
        {
            const playerData: CoreType.PlayerData = buildPlayerWithResearch([[GameType.ResearchType.CombustionDrive, 10]]);
            // Colony Ship base 2500 (Impulse); Combustion is the wrong engine, so it stays at base
            expect(ShipSpeed.computeShipSpeed(playerData, getShipSpeedDatas(GameType.ShipType.ColonyShip))).toBe(2500);
        });
    });

    describe('Impulse Drive (+20% per level) applies only to Impulse-engine ships', () =>
    {
        it('boosts the Colony Ship (a pure Impulse ship)', () =>
        {
            const playerData: CoreType.PlayerData = buildPlayerWithResearch([[GameType.ResearchType.ImpulseDrive, 3]]);
            // 2500 * (1 + 0.20 * 3) = 4000
            expect(ShipSpeed.computeShipSpeed(playerData, getShipSpeedDatas(GameType.ShipType.ColonyShip))).toBe(4000);
        });

        it('boosts the Small Transport after it switches to its Impulse tier at level 5', () =>
        {
            const playerData: CoreType.PlayerData = buildPlayerWithResearch([[GameType.ResearchType.ImpulseDrive, 6]]);
            // Impulse tier (base 10000): 10000 * (1 + 0.20 * 6) = 22000
            expect(ShipSpeed.computeShipSpeed(playerData, getShipSpeedDatas(GameType.ShipType.SmallTransport))).toBe(22000);
        });

        it('does NOT boost the Large Transport (a pure Combustion ship)', () =>
        {
            const playerData: CoreType.PlayerData = buildPlayerWithResearch([[GameType.ResearchType.ImpulseDrive, 10]]);
            expect(ShipSpeed.computeShipSpeed(playerData, getShipSpeedDatas(GameType.ShipType.LargeTransport))).toBe(7500);
        });

        it('does NOT boost the Small Transport while it is still on its Combustion tier (Impulse < 5)', () =>
        {
            const playerData: CoreType.PlayerData = buildPlayerWithResearch([[GameType.ResearchType.ImpulseDrive, 4]]);
            // Impulse 4 does not unlock the Impulse tier and gives no Combustion-tier bonus: stays at base 5000
            expect(ShipSpeed.computeShipSpeed(playerData, getShipSpeedDatas(GameType.ShipType.SmallTransport))).toBe(5000);
        });
    });

    describe('Hyperspace Drive (+30% per level) applies to no current ship', () =>
    {
        it('leaves every current ship at its base speed regardless of Hyperspace level', () =>
        {
            const playerData: CoreType.PlayerData = buildPlayerWithResearch([[GameType.ResearchType.HyperspaceDrive, 10]]);
            expect(ShipSpeed.computeShipSpeed(playerData, getShipSpeedDatas(GameType.ShipType.SmallTransport))).toBe(5000);
            expect(ShipSpeed.computeShipSpeed(playerData, getShipSpeedDatas(GameType.ShipType.LargeTransport))).toBe(7500);
            expect(ShipSpeed.computeShipSpeed(playerData, getShipSpeedDatas(GameType.ShipType.ColonyShip))).toBe(2500);
        });
    });

    describe('only the active engine of a ship is bonused', () =>
    {
        it('bonuses the Small Transport by Combustion while below the Impulse unlock', () =>
        {
            const playerData: CoreType.PlayerData = buildPlayerWithResearch([[GameType.ResearchType.CombustionDrive, 9], [GameType.ResearchType.ImpulseDrive, 4]]);
            // Still Combustion (Impulse 4 < 5): 5000 * (1 + 0.10 * 9) = 9500
            expect(ShipSpeed.computeShipSpeed(playerData, getShipSpeedDatas(GameType.ShipType.SmallTransport))).toBe(9500);
        });

        it('ignores the Combustion level on the Small Transport once it is on the Impulse tier', () =>
        {
            const playerData: CoreType.PlayerData = buildPlayerWithResearch([[GameType.ResearchType.CombustionDrive, 9], [GameType.ResearchType.ImpulseDrive, 5]]);
            // Now Impulse tier; Combustion 9 is irrelevant: 10000 * (1 + 0.20 * 5) = 20000
            expect(ShipSpeed.computeShipSpeed(playerData, getShipSpeedDatas(GameType.ShipType.SmallTransport))).toBe(20000);
        });

        it('ignores the Combustion level on the Colony Ship and counts only Impulse', () =>
        {
            const playerData: CoreType.PlayerData = buildPlayerWithResearch([[GameType.ResearchType.CombustionDrive, 5], [GameType.ResearchType.ImpulseDrive, 2]]);
            // Colony Ship is Impulse-only: Combustion 5 ignored, 2500 * (1 + 0.20 * 2) = 3500
            expect(ShipSpeed.computeShipSpeed(playerData, getShipSpeedDatas(GameType.ShipType.ColonyShip))).toBe(3500);
        });
    });
});
