const WRECK_FIELD_LEVEL_ONE_BASE_FRACTION: number = 0.45;
const WRECK_FIELD_LEVEL_BONUS_CAP: number = 0.12;

export function computeWreckFieldBaseFraction(repairDockLevel: number): number
{
    if (repairDockLevel <= 0)
    {
        return 0;
    }

    return WRECK_FIELD_LEVEL_ONE_BASE_FRACTION + WRECK_FIELD_LEVEL_BONUS_CAP * (1 - 1 / Math.sqrt(repairDockLevel));
}
