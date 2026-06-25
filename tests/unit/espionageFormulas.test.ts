import { describe, it, expect } from 'vitest';
import * as Espionage from '@/lib/gameplay/coreData/formula/espionageFormulas';

describe('computeEspionageReportLevel', () =>
{
    it('is just the probe count when tech is equal', () =>
    {
        expect(Espionage.computeEspionageReportLevel(3, 4, 4)).toBe(3);
    });

    it('adds the squared difference when the attacker is ahead', () =>
    {
        expect(Espionage.computeEspionageReportLevel(2, 7, 4)).toBe(2 + 9);
    });

    it('subtracts the squared difference when the defender is ahead', () =>
    {
        expect(Espionage.computeEspionageReportLevel(2, 4, 7)).toBe(2 - 9);
    });
});

describe('getRevealedInfoBlocks', () =>
{
    it('reveals nothing below the resource threshold', () =>
    {
        const revealedBlocks: Set<Espionage.EspionageInfoBlock> = Espionage.getRevealedInfoBlocks(0);
        expect(revealedBlocks.size).toBe(0);
    });

    it('reveals only resources at level 1', () =>
    {
        const revealedBlocks: Set<Espionage.EspionageInfoBlock> = Espionage.getRevealedInfoBlocks(1);
        expect(revealedBlocks.has(Espionage.EspionageInfoBlock.Resources)).toBe(true);
        expect(revealedBlocks.has(Espionage.EspionageInfoBlock.Fleet)).toBe(false);
    });

    it('reveals resources and fleet at level 2', () =>
    {
        const revealedBlocks: Set<Espionage.EspionageInfoBlock> = Espionage.getRevealedInfoBlocks(2);
        expect(revealedBlocks.has(Espionage.EspionageInfoBlock.Fleet)).toBe(true);
        expect(revealedBlocks.has(Espionage.EspionageInfoBlock.Buildings)).toBe(false);
    });

    it('reveals everything once the research threshold is reached', () =>
    {
        const revealedBlocks: Set<Espionage.EspionageInfoBlock> = Espionage.getRevealedInfoBlocks(5);
        expect(revealedBlocks.has(Espionage.EspionageInfoBlock.Resources)).toBe(true);
        expect(revealedBlocks.has(Espionage.EspionageInfoBlock.Fleet)).toBe(true);
        expect(revealedBlocks.has(Espionage.EspionageInfoBlock.Buildings)).toBe(true);
        expect(revealedBlocks.has(Espionage.EspionageInfoBlock.Research)).toBe(true);
    });
});

describe('computeCounterEspionageDetectionChance', () =>
{
    it('follows 2^(defenderTech - attackerTech) * probes * fleetSize * 0.25%', () =>
    {
        // 2^(3-1) * 4 * 5 * 0.0025 = 4 * 4 * 5 * 0.0025 = 0.2
        expect(Espionage.computeCounterEspionageDetectionChance(4, 1, 3, 5)).toBeCloseTo(0.2);
    });

    it('grows with the number of probes', () =>
    {
        const fewProbesChance: number = Espionage.computeCounterEspionageDetectionChance(1, 0, 0, 10);
        const manyProbesChance: number = Espionage.computeCounterEspionageDetectionChance(5, 0, 0, 10);
        expect(manyProbesChance).toBeGreaterThan(fewProbesChance);
    });

    it('grows with the defender fleet size', () =>
    {
        const smallFleetChance: number = Espionage.computeCounterEspionageDetectionChance(2, 0, 0, 5);
        const largeFleetChance: number = Espionage.computeCounterEspionageDetectionChance(2, 0, 0, 50);
        expect(largeFleetChance).toBeGreaterThan(smallFleetChance);
    });

    it('is higher when the defender is ahead on espionage tech', () =>
    {
        const defenderAheadChance: number = Espionage.computeCounterEspionageDetectionChance(1, 0, 3, 10);
        const attackerAheadChance: number = Espionage.computeCounterEspionageDetectionChance(1, 3, 0, 10);
        expect(defenderAheadChance).toBeGreaterThan(attackerAheadChance);
    });

    it('is zero when the defender has no fleet to shoot probes down', () =>
    {
        expect(Espionage.computeCounterEspionageDetectionChance(100, 0, 10, 0)).toBe(0);
    });

    it('never exceeds a probability of 1', () =>
    {
        const chance: number = Espionage.computeCounterEspionageDetectionChance(10000, 0, 50, 10000);
        expect(chance).toBe(1);
    });
});
