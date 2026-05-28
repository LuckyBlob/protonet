import { describe, it, expect } from 'vitest';
import * as GameType from '@/lib/gameplay/coreData/type/gameTypes';

describe('getDistance', () =>
{
    it('returns 0 for the same address', () =>
    {
        const address: GameType.PlanetAddress = { galaxy: 1, system: 1, slot: 1 };
        expect(GameType.getDistance(address, address)).toBe(0);
    });

    it('computes slot-only difference (same galaxy, same system)', () =>
    {
        const origin: GameType.PlanetAddress = { galaxy: 1, system: 1, slot: 1 };
        const target: GameType.PlanetAddress = { galaxy: 1, system: 1, slot: 3 };
        // 1000 + 2*55 = 1110
        expect(GameType.getDistance(origin, target)).toBe(1110);
    });

    it('computes system difference (same galaxy, ignores slot)', () =>
    {
        const origin: GameType.PlanetAddress = { galaxy: 1, system: 1, slot: 1 };
        const target: GameType.PlanetAddress = { galaxy: 1, system: 5, slot: 4 };
        // 2700 + 4*95 = 3080 (slot difference ignored when system differs)
        expect(GameType.getDistance(origin, target)).toBe(3080);
    });

    it('computes galaxy difference (ignores system and slot)', () =>
    {
        const origin: GameType.PlanetAddress = { galaxy: 1, system: 1, slot: 1 };
        const target: GameType.PlanetAddress = { galaxy: 2, system: 10, slot: 5 };
        // 1 * 20000 = 20000 (system and slot ignored when galaxy differs)
        expect(GameType.getDistance(origin, target)).toBe(20000);
    });

    it('is symmetric', () =>
    {
        const a: GameType.PlanetAddress = { galaxy: 1, system: 3, slot: 2 };
        const b: GameType.PlanetAddress = { galaxy: 1, system: 10, slot: 4 };
        expect(GameType.getDistance(a, b)).toBe(GameType.getDistance(b, a));
    });

    it('uses absolute galaxy difference', () =>
    {
        const a: GameType.PlanetAddress = { galaxy: 2, system: 1, slot: 1 };
        const b: GameType.PlanetAddress = { galaxy: 1, system: 1, slot: 1 };
        expect(GameType.getDistance(a, b)).toBe(20000);
    });
});

describe('isSameAddress', () =>
{
    it('returns true for identical addresses', () =>
    {
        const address: GameType.PlanetAddress = { galaxy: 2, system: 5, slot: 3 };
        expect(GameType.isSameAddress(address, address)).toBe(true);
    });

    it('returns false when galaxy differs', () =>
    {
        const base: GameType.PlanetAddress = { galaxy: 1, system: 1, slot: 1 };
        expect(GameType.isSameAddress(base, { galaxy: 2, system: 1, slot: 1 })).toBe(false);
    });

    it('returns false when system differs', () =>
    {
        const base: GameType.PlanetAddress = { galaxy: 1, system: 1, slot: 1 };
        expect(GameType.isSameAddress(base, { galaxy: 1, system: 2, slot: 1 })).toBe(false);
    });

    it('returns false when slot differs', () =>
    {
        const base: GameType.PlanetAddress = { galaxy: 1, system: 1, slot: 1 };
        expect(GameType.isSameAddress(base, { galaxy: 1, system: 1, slot: 2 })).toBe(false);
    });
});

describe('rollSizeForSlot', () =>
{
    const SLOT_RANGES: { min: number; max: number; }[] =
    [
        { min: 40,  max: 70  },
        { min: 120, max: 310 },
        { min: 125, max: 255 },
        { min: 75,  max: 125 },
        { min: 60,  max: 90  },
    ];

    it('returns a size within the valid range for each slot', () =>
    {
        for (let slot: number = 1; slot <= 5; slot++)
        {
            const range: { min: number; max: number; } = SLOT_RANGES[slot - 1]!;

            for (let trial: number = 0; trial < 30; trial++)
            {
                const size: number = GameType.rollSizeForSlot(slot);
                expect(size).toBeGreaterThanOrEqual(range.min);
                expect(size).toBeLessThanOrEqual(range.max);
            }
        }
    });
});
