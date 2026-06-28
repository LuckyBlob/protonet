import { describe, it, expect } from 'vitest';
import * as BuildingDeconstructionAnchorEvent from '@/lib/gameplay/progressUpdate/anchorEvent/buildingDeconstructionAnchorEvent';
import * as AnchorEvent from '@/lib/gameplay/progressUpdate/anchorEvent';
import * as CoreType from '@/lib/gameplay/coreData/type/coreTypes';
import * as GameType from '@/lib/gameplay/coreData/type/gameTypes';
import * as DBType from '@/lib/db/dbTypes';
import * as BuildingData from '@/lib/gameplay/dynamicData/planet/buildingData';
import * as BuildingCost from '@/lib/gameplay/coreData/formula/buildingCostFormulas';
import * as StaticDataHelper from '@/lib/gameplay/coreData/static/staticDataHelpers';
import * as TestDataBuilders from '../helpers/testDataBuilders';
import * as TestProgressApplierHelper from '../helpers/testProgressApplier';

const APPLIER: TestProgressApplierHelper.TestProgressApplier = new TestProgressApplierHelper.TestProgressApplier();

function buildDeconstructionOnPlanet(planetId: number, startedAt: number, durationMs: number, buildingType: number): CoreType.BuildingDeconstruction
{
    const buildingRow: DBType.BuildingDeconstructionBuildingRow = TestDataBuilders.buildBuildingDeconstructionBuildingRow({
        id: 1,
        building_type: buildingType,
    });

    const deconstruction: CoreType.BuildingDeconstruction =
    {
        buildingDeconstructionRow: TestDataBuilders.buildBuildingDeconstructionRow({
            id: 1,
            planet_id: planetId,
            started_at: startedAt,
            duration_at_start_time: durationMs,
            current_building_deconstruction_building_row_id: 1,
        }),
        buildingDeconstructionBuildingRows: [buildingRow],
        buildingDeconstructionResourceRows: [],
    };

    return deconstruction;
}

describe('computeBuildingDeconstructionCost', () =>
{
    it('returns null when the building is at level 0', () =>
    {
        const cost: Map<GameType.ResourceType, number> | null = BuildingCost.computeBuildingDeconstructionCost(0, GameType.BuildingType.MetalMine);
        expect(cost).toBeNull();
    });

    it('costs half the build cost of the level being removed', () =>
    {
        const currentLevel: number = 4;
        const removedLevelBuildCost: Map<GameType.ResourceType, number> | null = BuildingCost.computeBuildingUpgradeCost(currentLevel - 1, GameType.BuildingType.MetalMine);
        const deconstructionCost: Map<GameType.ResourceType, number> | null = BuildingCost.computeBuildingDeconstructionCost(currentLevel, GameType.BuildingType.MetalMine);

        expect(removedLevelBuildCost).not.toBeNull();
        expect(deconstructionCost).not.toBeNull();

        for (const [resourceType, buildResourceCost] of removedLevelBuildCost!)
        {
            expect(deconstructionCost!.get(resourceType)).toBe(Math.floor(buildResourceCost / 2));
        }
    });

    it('produces the exact expected amounts for a known building and level', () =>
    {
        // Metal Mine: base { Metal 60, Crystal 15 }, exponent 1.5. The cost to build level 3 is
        // floor(base * 1.5^2) = { Metal 135, Crystal 33 }; deconstruction charges half of that, floored.
        const deconstructionCost: Map<GameType.ResourceType, number> | null = BuildingCost.computeBuildingDeconstructionCost(3, GameType.BuildingType.MetalMine);

        expect(deconstructionCost).not.toBeNull();
        expect(deconstructionCost!.get(GameType.ResourceType.Metal)).toBe(67);
        expect(deconstructionCost!.get(GameType.ResourceType.Crystal)).toBe(16);
    });
});

describe('canDeconstructBuilding', () =>
{
    it('forbids tearing down the Terraformer and the Lunar Base', () =>
    {
        expect(StaticDataHelper.canDeconstructBuilding(GameType.BuildingType.Terraformer)).toBe(false);
        expect(StaticDataHelper.canDeconstructBuilding(GameType.BuildingType.LunarBase)).toBe(false);
    });

    it('allows tearing down ordinary buildings', () =>
    {
        expect(StaticDataHelper.canDeconstructBuilding(GameType.BuildingType.MetalMine)).toBe(true);
        expect(StaticDataHelper.canDeconstructBuilding(GameType.BuildingType.Shipyard)).toBe(true);
    });
});

describe('findNextAnchorEvent (building deconstruction)', () =>
{
    it('returns null when no deconstructions exist', () =>
    {
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData();
        const result: AnchorEvent.AnchorEvent | null = BuildingDeconstructionAnchorEvent.findNextAnchorEvent(playerData, TestDataBuilders.buildServerData(), APPLIER);
        expect(result).toBeNull();
    });

    it('returns the anchor event with the correct completion time', () =>
    {
        const startedAt: number = 1_000_000;
        const durationMs: number = 30_000;
        const deconstruction: CoreType.BuildingDeconstruction = buildDeconstructionOnPlanet(1, startedAt, durationMs, GameType.BuildingType.MetalMine);

        const planet: CoreType.PlanetData = TestDataBuilders.buildPlanetData({
            dynamicPlanetData: { buildingDeconstructions: [deconstruction] },
        });
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ planetDatas: [planet] });
        const result: AnchorEvent.AnchorEvent | null = BuildingDeconstructionAnchorEvent.findNextAnchorEvent(playerData, TestDataBuilders.buildServerData(), APPLIER);

        expect(result).not.toBeNull();
        expect(result!.type).toBe(AnchorEvent.AnchorEventType.BuildingDeconstruction);
        expect(result!.time).toBe(startedAt + durationMs);
    });
});

describe('resolveAnchorEvent (building deconstruction)', () =>
{
    it('decrements the building level and removes the deconstruction', () =>
    {
        const deconstruction: CoreType.BuildingDeconstruction = buildDeconstructionOnPlanet(1, 1_000_000, 30_000, GameType.BuildingType.MetalMine);

        const planet: CoreType.PlanetData = TestDataBuilders.buildPlanetData({
            dynamicPlanetData:
            {
                buildingLevels: new Map<GameType.BuildingType, number>([[GameType.BuildingType.MetalMine, 3]]),
                buildingDeconstructions: [deconstruction],
            },
        });
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ planetDatas: [planet] });
        const serverData: CoreType.ServerData = TestDataBuilders.buildServerData();

        const anchorEventResult: AnchorEvent.AnchorEvent | null = BuildingDeconstructionAnchorEvent.findNextAnchorEvent(playerData, serverData, APPLIER);
        expect(anchorEventResult).not.toBeNull();
        BuildingDeconstructionAnchorEvent.resolveAnchorEvent(playerData, serverData, anchorEventResult!);

        const levelAfter: number = BuildingData.getBuildingLevel(playerData.planetDatas[0]!, GameType.BuildingType.MetalMine);
        expect(levelAfter).toBe(2);
        expect(playerData.planetDatas[0]!.dynamicPlanetData.buildingDeconstructions).toHaveLength(0);
    });

    it('never takes a building below level 0', () =>
    {
        const deconstruction: CoreType.BuildingDeconstruction = buildDeconstructionOnPlanet(1, 1_000_000, 30_000, GameType.BuildingType.MetalMine);

        const planet: CoreType.PlanetData = TestDataBuilders.buildPlanetData({
            dynamicPlanetData:
            {
                buildingLevels: new Map<GameType.BuildingType, number>([[GameType.BuildingType.MetalMine, 0]]),
                buildingDeconstructions: [deconstruction],
            },
        });
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ planetDatas: [planet] });
        const serverData: CoreType.ServerData = TestDataBuilders.buildServerData();

        const anchorEventResult: AnchorEvent.AnchorEvent | null = BuildingDeconstructionAnchorEvent.findNextAnchorEvent(playerData, serverData, APPLIER);
        expect(anchorEventResult).not.toBeNull();
        BuildingDeconstructionAnchorEvent.resolveAnchorEvent(playerData, serverData, anchorEventResult!);

        const levelAfter: number = BuildingData.getBuildingLevel(playerData.planetDatas[0]!, GameType.BuildingType.MetalMine);
        expect(levelAfter).toBe(0);
    });
});
