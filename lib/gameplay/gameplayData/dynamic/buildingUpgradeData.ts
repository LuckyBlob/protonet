import * as PlayerDataType from "@/lib/gameplay/gameplayData/player/playerDataTypes";

export function getBuildingUpgradeRemainingMs(fullPlanetData: PlayerDataType.FullPlanetData): number | null
{
    if (fullPlanetData.planetRow.building_upgrade_completes_at === 0)
    {
        return null;
    }

    return fullPlanetData.planetRow.building_upgrade_completes_at - Date.now();
}