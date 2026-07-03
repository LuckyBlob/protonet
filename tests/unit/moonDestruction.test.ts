import { describe, it, expect } from 'vitest';
import * as Combat from '@/lib/gameplay/coreData/formula/combatFormulas';
import * as StaticDataHelper from '@/lib/gameplay/coreData/static/staticDataHelpers';
import * as RequirementValueGetters from '@/lib/gameplay/coreData/requirement/requirementValueGetters';
import * as RequirementType from '@/lib/gameplay/coreData/requirement/requirementTypes';
import * as CoreType from '@/lib/gameplay/coreData/type/coreTypes';
import * as GameType from '@/lib/gameplay/coreData/type/gameTypes';
import * as TestDataBuilders from '../helpers/testDataBuilders';

describe('computeMoonDiameterKm', () =>
{
    it('inverts the field derivation of computeMoonSizeFields', () =>
    {
        expect(Combat.computeMoonDiameterKm(1)).toBe(1000);
        expect(Combat.computeMoonDiameterKm(64)).toBe(8000);
        expect(Combat.computeMoonDiameterKm(1600)).toBe(40000);
    });
});

describe('computeMoonDestructionChancePercent', () =>
{
    it('follows (100 - sqrt(diameter)) * sqrt(deathstarCount)', () =>
    {
        expect(Combat.computeMoonDestructionChancePercent(64, 1)).toBeCloseTo(10.557, 2);
        expect(Combat.computeMoonDestructionChancePercent(64, 4)).toBeCloseTo(21.115, 2);
    });

    it('clamps above 100 for many Death Stars on a small moon', () =>
    {
        expect(Combat.computeMoonDestructionChancePercent(1, 100)).toBe(100);
    });

    it('clamps to 0 for a moon too large to be dented', () =>
    {
        expect(Combat.computeMoonDestructionChancePercent(1600, 10)).toBe(0);
    });
});

describe('computeAttackerFleetDestructionChancePercent', () =>
{
    it('follows sqrt(diameter) / 2', () =>
    {
        expect(Combat.computeAttackerFleetDestructionChancePercent(64)).toBeCloseTo(44.721, 2);
        expect(Combat.computeAttackerFleetDestructionChancePercent(1)).toBeCloseTo(15.811, 2);
    });

    it('clamps to 100 for a very large moon', () =>
    {
        expect(Combat.computeAttackerFleetDestructionChancePercent(1600)).toBe(100);
    });
});

describe('rollMoonDestruction and rollAttackerFleetDestruction', () =>
{
    it('never fires at 0% and always fires at 100%', () =>
    {
        expect(Combat.rollMoonDestruction(7, 0)).toBe(false);
        expect(Combat.rollMoonDestruction(999, 100)).toBe(true);
        expect(Combat.rollAttackerFleetDestruction(7, 0)).toBe(false);
        expect(Combat.rollAttackerFleetDestruction(999, 100)).toBe(true);
    });

    it('compares the seeded draw against the chance fraction', () =>
    {
        expect(Combat.rollMoonDestruction(7, 2)).toBe(true);
        expect(Combat.rollMoonDestruction(7, 1)).toBe(false);
        expect(Combat.rollAttackerFleetDestruction(999, 50)).toBe(false);
    });
});

describe('unitParticipatesInMoonDestruction', () =>
{
    it('is true only for the Death Star', () =>
    {
        expect(StaticDataHelper.unitParticipatesInMoonDestruction(GameType.UnitType.Deathstar)).toBe(true);
        expect(StaticDataHelper.unitParticipatesInMoonDestruction(GameType.UnitType.SmallTransport)).toBe(false);
        expect(StaticDataHelper.unitParticipatesInMoonDestruction(GameType.UnitType.RocketLauncher)).toBe(false);
        expect(StaticDataHelper.unitParticipatesInMoonDestruction(GameType.UnitType.ColonyShip)).toBe(false);
    });
});

describe('fleetHasMoonDestructionUnit', () =>
{
    const getter: RequirementType.ThingValueGetter = RequirementValueGetters.fleetHasMoonDestructionUnit();
    const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData();

    it('returns 1 when the fleet has at least one Death Star', () =>
    {
        const unitQuantities: Map<GameType.UnitType, number> = new Map<GameType.UnitType, number>([[GameType.UnitType.Deathstar, 1], [GameType.UnitType.SmallTransport, 50]]);
        expect(getter({ playerData: playerData, planetId: 1, unitQuantities: unitQuantities })).toBe(1);
    });

    it('returns 0 when the fleet has no Death Star', () =>
    {
        const unitQuantities: Map<GameType.UnitType, number> = new Map<GameType.UnitType, number>([[GameType.UnitType.SmallTransport, 50]]);
        expect(getter({ playerData: playerData, planetId: 1, unitQuantities: unitQuantities })).toBe(0);
    });

    it('returns 0 when the Death Star quantity is 0', () =>
    {
        const unitQuantities: Map<GameType.UnitType, number> = new Map<GameType.UnitType, number>([[GameType.UnitType.Deathstar, 0]]);
        expect(getter({ playerData: playerData, planetId: 1, unitQuantities: unitQuantities })).toBe(0);
    });

    it('throws when evaluated without a potential fleet action', () =>
    {
        expect(() => getter({ playerData: playerData, planetId: 1 })).toThrow();
    });
});
