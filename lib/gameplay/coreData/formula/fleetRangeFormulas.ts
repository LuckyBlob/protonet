import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";

export const MISSILE_RANGE_SYSTEMS_PER_IMPULSE_LEVEL: number = 5;
const MISSILE_RANGE_SYSTEMS_OFFSET: number = -1;

export function computeMissileRangeSystems(impulseDriveLevel: number): number
{
	return impulseDriveLevel * MISSILE_RANGE_SYSTEMS_PER_IMPULSE_LEVEL + MISSILE_RANGE_SYSTEMS_OFFSET;
}

export function isTargetWithinMissileRange(originAddress: GameType.PlanetAddress, targetAddress: GameType.PlanetAddress, impulseDriveLevel: number): boolean
{
	if (originAddress.galaxy !== targetAddress.galaxy)
	{
		return false;
	}

	const rangeSystems: number = computeMissileRangeSystems(impulseDriveLevel);
	if (rangeSystems < 0)
	{
		return false;
	}

	const systemDistance: number = Math.abs(originAddress.system - targetAddress.system);
	return systemDistance <= rangeSystems;
}

export function isWithinRange(originAddress: GameType.PlanetAddress, targetAddress: GameType.PlanetAddress, speedStats: GameType.SpeedStats, impulseDriveLevel: number): boolean
{
	if (speedStats.rangeFunctionType === undefined)
	{
		return true;
	}

	switch (speedStats.rangeFunctionType)
	{
		case GameType.RangeFunctionType.Missile:
		{
			return isTargetWithinMissileRange(originAddress, targetAddress, impulseDriveLevel);
		}
		default:
			throw new Error(`UNREACHABLE: Missing RangeFunctionType case: ${speedStats.rangeFunctionType}`);
	}
}
