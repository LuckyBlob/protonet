import { describe, it, expect } from 'vitest';
import * as FleetRange from '@/lib/gameplay/coreData/formula/fleetRangeFormulas';
import * as GameType from '@/lib/gameplay/coreData/type/gameTypes';

const ORIGIN: GameType.PlanetAddress = { galaxy: 1, system: 50, slot: 3, zone: GameType.PlanetZone.Planet };

function addressAt(galaxy: number, system: number): GameType.PlanetAddress
{
    return { galaxy: galaxy, system: system, slot: 3, zone: GameType.PlanetZone.Planet };
}

const MISSILE_SPEED: GameType.SpeedStats = { engineTechData: [], speedFunctionType: GameType.SpeedFunctionType.Missile, rangeFunctionType: GameType.RangeFunctionType.Missile };
const SHIP_SPEED: GameType.SpeedStats = { engineTechData: [], speedFunctionType: GameType.SpeedFunctionType.EngineDrive };

describe('computeMissileRangeSystems', () =>
{
    it('is impulse*5 - 1', () =>
    {
        expect(FleetRange.computeMissileRangeSystems(0)).toBe(-1);
        expect(FleetRange.computeMissileRangeSystems(1)).toBe(4);
        expect(FleetRange.computeMissileRangeSystems(5)).toBe(24);
    });
});

describe('isTargetWithinMissileRange', () =>
{
    it('is within range when the system distance is at most the range, same galaxy', () =>
    {
        expect(FleetRange.isTargetWithinMissileRange(ORIGIN, addressAt(1, 26), 5)).toBe(true);
        expect(FleetRange.isTargetWithinMissileRange(ORIGIN, addressAt(1, 74), 5)).toBe(true);
    });

    it('is out of range when the system distance exceeds the range', () =>
    {
        expect(FleetRange.isTargetWithinMissileRange(ORIGIN, addressAt(1, 75), 5)).toBe(false);
    });

    it('never crosses galaxies', () =>
    {
        expect(FleetRange.isTargetWithinMissileRange(ORIGIN, addressAt(2, 50), 5)).toBe(false);
    });

    it('cannot reach anything at impulse 0 (range -1), not even the same system', () =>
    {
        expect(FleetRange.isTargetWithinMissileRange(ORIGIN, addressAt(1, 50), 0)).toBe(false);
    });
});

describe('isWithinRange dispatch', () =>
{
    it('treats a unit with no rangeFunctionType as always in range', () =>
    {
        expect(FleetRange.isWithinRange(ORIGIN, addressAt(2, 99), SHIP_SPEED, 0)).toBe(true);
    });

    it('binds a missile unit by its Impulse Drive range', () =>
    {
        expect(FleetRange.isWithinRange(ORIGIN, addressAt(1, 60), MISSILE_SPEED, 5)).toBe(true);
        expect(FleetRange.isWithinRange(ORIGIN, addressAt(1, 80), MISSILE_SPEED, 5)).toBe(false);
    });
});
