import { describe, it, expect } from 'vitest';
import * as JumpGate from '@/lib/gameplay/coreData/formula/jumpGateFormulas';

describe('computeJumpGateCooldownSeconds', () =>
{
    it('matches the OGame anchor points', () =>
    {
        expect(JumpGate.computeJumpGateCooldownSeconds(1)).toBe(3600);
        expect(JumpGate.computeJumpGateCooldownSeconds(10)).toBe(1000);
        expect(JumpGate.computeJumpGateCooldownSeconds(15)).toBe(600);
    });

    it('floors the reduction at level 15 for higher levels', () =>
    {
        expect(JumpGate.computeJumpGateCooldownSeconds(16)).toBe(600);
        expect(JumpGate.computeJumpGateCooldownSeconds(20)).toBe(600);
    });

    it('caps at 3600 for level 1 and below', () =>
    {
        expect(JumpGate.computeJumpGateCooldownSeconds(0)).toBe(3600);
    });

    it('decreases monotonically from level 1 to 15', () =>
    {
        let previousCooldown: number = JumpGate.computeJumpGateCooldownSeconds(1);
        for (let level: number = 2; level <= 15; level = level + 1)
        {
            const currentCooldown: number = JumpGate.computeJumpGateCooldownSeconds(level);
            expect(currentCooldown).toBeLessThan(previousCooldown);
            previousCooldown = currentCooldown;
        }
    });
});
