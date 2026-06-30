export const SCAN_DEUTERIUM_COST: number = 5000;

export function computeScanRangeSystems(sensorPhalanxLevel: number): number
{
    if (sensorPhalanxLevel < 1)
    {
        return 0;
    }

    return (sensorPhalanxLevel * sensorPhalanxLevel) - 1;
}
