const JUMP_GATE_MAX_COOLDOWN_SECONDS: number = 3600;
const JUMP_GATE_MIN_COOLDOWN_SECONDS: number = 600;
const JUMP_GATE_MAX_REDUCTION_LEVEL: number = 15;

// OGame parabola through f(1)=3600, f(10)=1000, f(15)=600s (coeffs/63 exact), capped at level 15 (1/6 floor).
export function computeJumpGateCooldownSeconds(jumpGateLevel: number): number
{
    const effectiveLevel: number = Math.min(jumpGateLevel, JUMP_GATE_MAX_REDUCTION_LEVEL);

    const rawCooldownSeconds: number = (940 * effectiveLevel * effectiveLevel - 28540 * effectiveLevel + 254400) / 63;

    const flooredCooldownSeconds: number = Math.max(JUMP_GATE_MIN_COOLDOWN_SECONDS, rawCooldownSeconds);
    const cappedCooldownSeconds: number = Math.min(JUMP_GATE_MAX_COOLDOWN_SECONDS, flooredCooldownSeconds);

    return Math.round(cappedCooldownSeconds);
}
