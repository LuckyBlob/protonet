import { describe, it, expect } from 'vitest';
import * as FleetMovementDuration from '@/lib/gameplay/coreData/formula/fleetMovementDurationFormulas';
import * as FleetData from '@/lib/gameplay/dynamicData/planet/fleet/fleetData';
import * as CoreType from '@/lib/gameplay/coreData/type/coreTypes';
import * as GameType from '@/lib/gameplay/coreData/type/gameTypes';
import * as MathHelp from '@/lib/helper/mathHelp';
import * as TestDataBuilders from '../helpers/testDataBuilders';

const PLAYER_DATA: CoreType.PlayerData = TestDataBuilders.buildPlayerData();
const SERVER_DATA: CoreType.ServerData = TestDataBuilders.buildServerData();
const ORIGIN: GameType.PlanetAddress = { galaxy: 1, system: 1, slot: 3, zone: GameType.PlanetZone.Planet };
const TARGET: GameType.PlanetAddress = { galaxy: 1, system: 8, slot: 3, zone: GameType.PlanetZone.Planet };
const UNIT_QUANTITIES: Map<GameType.UnitType, number> = new Map<GameType.UnitType, number>([[GameType.UnitType.SmallTransport, 1]]);

describe('fleet speed factor — travel duration', () =>
{
    it('scales the distance term with the inverse of speed while leaving the flat overhead unscaled (OGame)', () =>
    {
        const fullSpeedSeconds: number = FleetMovementDuration.computeFleetMovementDurationSecondsFromAddresses(PLAYER_DATA, ORIGIN, TARGET, UNIT_QUANTITIES, SERVER_DATA, 100);
        const halfSpeedSeconds: number = FleetMovementDuration.computeFleetMovementDurationSecondsFromAddresses(PLAYER_DATA, ORIGIN, TARGET, UNIT_QUANTITIES, SERVER_DATA, 50);
        const tenthSpeedSeconds: number = FleetMovementDuration.computeFleetMovementDurationSecondsFromAddresses(PLAYER_DATA, ORIGIN, TARGET, UNIT_QUANTITIES, SERVER_DATA, 10);

        expect(halfSpeedSeconds).toBeGreaterThan(fullSpeedSeconds);
        expect(tenthSpeedSeconds).toBeGreaterThan(halfSpeedSeconds);

        // The 35000/speedFactor term scales ~10x at 10% speed, but the flat +10 overhead is NOT multiplied,
        // so the total is just under a naive 10x (and under a naive 2x at 50%).
        expect(tenthSpeedSeconds).toBeLessThan(fullSpeedSeconds * 10);
        expect(tenthSpeedSeconds).toBeGreaterThan(fullSpeedSeconds * 9);
        expect(halfSpeedSeconds).toBeLessThan(fullSpeedSeconds * 2);
    });

    it('defaults to full speed when no percentage is supplied', () =>
    {
        const defaultSeconds: number = FleetMovementDuration.computeFleetMovementDurationSecondsFromAddresses(PLAYER_DATA, ORIGIN, TARGET, UNIT_QUANTITIES, SERVER_DATA);
        const fullSpeedSeconds: number = FleetMovementDuration.computeFleetMovementDurationSecondsFromAddresses(PLAYER_DATA, ORIGIN, TARGET, UNIT_QUANTITIES, SERVER_DATA, 100);

        expect(defaultSeconds).toBe(fullSpeedSeconds);
    });
});

describe('clampSpeedPercentage (anti-hack)', () =>
{
    it('clamps 0 and negatives up to the 10% minimum (no zero/infinite-speed hack)', () =>
    {
        expect(FleetMovementDuration.clampSpeedPercentage(0)).toBe(10);
        expect(FleetMovementDuration.clampSpeedPercentage(-50)).toBe(10);
        expect(FleetMovementDuration.clampSpeedPercentage(5)).toBe(10);
    });

    it('clamps above-100 values down to 100 and leaves valid values untouched', () =>
    {
        expect(FleetMovementDuration.clampSpeedPercentage(150)).toBe(100);
        expect(FleetMovementDuration.clampSpeedPercentage(50)).toBe(50);
        expect(FleetMovementDuration.clampSpeedPercentage(100)).toBe(100);
        expect(FleetMovementDuration.clampSpeedPercentage(10)).toBe(10);
    });
});

describe('fleet speed factor — fuel consumption', () =>
{
    it('burns less fuel as the speed percentage drops', () =>
    {
        const fullSpeedFuel: number = MathHelp.calculateTotalQuantityMap(FleetData.calculateTotalFleetFuel(PLAYER_DATA, ORIGIN, TARGET, UNIT_QUANTITIES, SERVER_DATA, 100));
        const halfSpeedFuel: number = MathHelp.calculateTotalQuantityMap(FleetData.calculateTotalFleetFuel(PLAYER_DATA, ORIGIN, TARGET, UNIT_QUANTITIES, SERVER_DATA, 50));
        const tenthSpeedFuel: number = MathHelp.calculateTotalQuantityMap(FleetData.calculateTotalFleetFuel(PLAYER_DATA, ORIGIN, TARGET, UNIT_QUANTITIES, SERVER_DATA, 10));

        expect(fullSpeedFuel).toBeGreaterThan(halfSpeedFuel);
        expect(halfSpeedFuel).toBeGreaterThan(tenthSpeedFuel);
    });
});
