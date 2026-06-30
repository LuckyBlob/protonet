import { describe, it, expect } from 'vitest';
import * as SensorPhalanx from '@/lib/gameplay/coreData/formula/sensorPhalanxFormulas';

describe('computeScanRangeSystems', () =>
{
    it('is zero below level 1', () =>
    {
        expect(SensorPhalanx.computeScanRangeSystems(0)).toBe(0);
    });

    it('is zero at level 1 (own system only)', () =>
    {
        expect(SensorPhalanx.computeScanRangeSystems(1)).toBe(0);
    });

    it('is level squared minus one', () =>
    {
        expect(SensorPhalanx.computeScanRangeSystems(2)).toBe(3);
        expect(SensorPhalanx.computeScanRangeSystems(3)).toBe(8);
        expect(SensorPhalanx.computeScanRangeSystems(5)).toBe(24);
    });
});

describe('SCAN_DEUTERIUM_COST', () =>
{
    it('is the OGame flat 5000 deuterium', () =>
    {
        expect(SensorPhalanx.SCAN_DEUTERIUM_COST).toBe(5000);
    });
});
