// Unit value counts only countsInUnitValue resources (metal + crystal); unlike scoreData's invested value it excludes deuterium.
import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as StaticDataHelper from "@/lib/gameplay/coreData/static/staticDataHelpers";

export function computeUnitValue(unitType: GameType.UnitType, unitQuantity: number): number
{
    const costMap: Map<GameType.ResourceType, number> = StaticDataHelper.getUnitStats(unitType).costMap;
    let unitValue: number = 0;

    for (const [resourceType, resourceCost] of costMap)
    {
        if (StaticDataHelper.resourceCountsInUnitValue(resourceType) === false)
        {
            continue;
        }

        unitValue += resourceCost;
    }

    return unitValue * unitQuantity;
}
