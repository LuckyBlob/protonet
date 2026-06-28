import { describe, it, expect } from 'vitest';
import * as AnchorEvent from '@/lib/gameplay/progressUpdate/anchorEvent';
import * as CoreType from '@/lib/gameplay/coreData/type/coreTypes';
import * as GameType from '@/lib/gameplay/coreData/type/gameTypes';
import * as TestDataBuilders from '../helpers/testDataBuilders';
import * as TestProgressApplierHelper from '../helpers/testProgressApplier';

// Across-type priority for PlayerProgressApplier.getNextAnchorEvent. The integration tests
// only exercise building upgrade resolution; these unit tests pin the cross-type ordering.

const APPLIER: TestProgressApplierHelper.TestProgressApplier = new TestProgressApplierHelper.TestProgressApplier();
const BASE_TIME: number = 1_000_000;

function buildUpgradeAt(planetId: number, completionTime: number): CoreType.BuildingUpgrade
{
    return {
        buildingUpgradeRow: TestDataBuilders.buildBuildingUpgradeRow(
        {
            planet_id: planetId,
            started_at: BASE_TIME,
            duration_at_start_time: completionTime - BASE_TIME,
            current_building_upgrade_building_row_id: 1,
        }),
        buildingUpgradeBuildingRows: [TestDataBuilders.buildBuildingUpgradeBuildingRow({ id: 1 })],
        buildingUpgradeResourceRows: [],
    };
}

function buildConstructionAt(planetId: number, completionTime: number): CoreType.UnitConstruction
{
    return {
        unitConstructionRow: TestDataBuilders.buildUnitConstructionRow(
        {
            planet_id: planetId,
            started_at: BASE_TIME,
            duration_at_start_time: completionTime - BASE_TIME,
            current_unit_construction_unit_row_id: 1,
        }),
        unitConstructionUnitRows: [TestDataBuilders.buildUnitConstructionUnitRow({ id: 1 })],
    };
}

function buildFleetAt(completionTime: number): CoreType.FleetMovement
{
    return TestDataBuilders.buildFleetMovement(
    {
        fleetMovementRow:
        {
            started_at: BASE_TIME,
            duration_at_start_time: completionTime - BASE_TIME,
        },
        resolutionState: CoreType.FleetMovementResolution.Unresolved,
    });
}

describe('PlayerProgressApplier.getNextAnchorEvent — across-type priority', () =>
{
    it('returns null when nothing is queued anywhere', () =>
    {
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData();
        const result: AnchorEvent.AnchorEvent | null = APPLIER.getNextAnchorEvent(playerData, TestDataBuilders.buildServerData());
        expect(result).toBeNull();
    });

    it('picks a building upgrade when it completes before a unit construction', () =>
    {
        const upgrade: CoreType.BuildingUpgrade = buildUpgradeAt(1, BASE_TIME + 10_000);
        const construction: CoreType.UnitConstruction = buildConstructionAt(1, BASE_TIME + 50_000);

        const planet: CoreType.PlanetData = TestDataBuilders.buildPlanetData(
        {
            dynamicPlanetData: { buildingUpgrades: [upgrade], unitConstructions: [construction] },
        });
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ planetDatas: [planet] });

        const result: AnchorEvent.AnchorEvent | null = APPLIER.getNextAnchorEvent(playerData, TestDataBuilders.buildServerData());
        expect(result).not.toBeNull();
        expect(result!.type).toBe(AnchorEvent.AnchorEventType.BuildingUpgrade);
        expect(result!.time).toBe(BASE_TIME + 10_000);
    });

    it('picks a unit construction when it completes before a building upgrade', () =>
    {
        const upgrade: CoreType.BuildingUpgrade = buildUpgradeAt(1, BASE_TIME + 50_000);
        const construction: CoreType.UnitConstruction = buildConstructionAt(1, BASE_TIME + 10_000);

        const planet: CoreType.PlanetData = TestDataBuilders.buildPlanetData(
        {
            dynamicPlanetData: { buildingUpgrades: [upgrade], unitConstructions: [construction] },
        });
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ planetDatas: [planet] });

        const result: AnchorEvent.AnchorEvent | null = APPLIER.getNextAnchorEvent(playerData, TestDataBuilders.buildServerData());
        expect(result).not.toBeNull();
        expect(result!.type).toBe(AnchorEvent.AnchorEventType.UnitConstruction);
        expect(result!.time).toBe(BASE_TIME + 10_000);
    });

    it('picks a fleet arrival when it completes before a building upgrade', () =>
    {
        const upgrade: CoreType.BuildingUpgrade = buildUpgradeAt(1, BASE_TIME + 50_000);
        const fleet: CoreType.FleetMovement = buildFleetAt(BASE_TIME + 10_000);

        const planet: CoreType.PlanetData = TestDataBuilders.buildPlanetData(
        {
            dynamicPlanetData: { buildingUpgrades: [upgrade], futureFleetArrivals: [fleet] },
        });
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ planetDatas: [planet] });

        const result: AnchorEvent.AnchorEvent | null = APPLIER.getNextAnchorEvent(playerData, TestDataBuilders.buildServerData());
        expect(result).not.toBeNull();
        expect(result!.type).toBe(AnchorEvent.AnchorEventType.FleetArrival);
    });

    it('keeps the first-found of two events that complete at the same time', () =>
    {
        // The base PlayerProgressApplier uses `>` (strictly greater) for replacement.
        // Pin the current order: BuildingUpgrade is checked first, so ties are kept as BuildingUpgrade.
        const upgrade: CoreType.BuildingUpgrade = buildUpgradeAt(1, BASE_TIME + 10_000);
        const construction: CoreType.UnitConstruction = buildConstructionAt(1, BASE_TIME + 10_000);

        const planet: CoreType.PlanetData = TestDataBuilders.buildPlanetData(
        {
            dynamicPlanetData: { buildingUpgrades: [upgrade], unitConstructions: [construction] },
        });
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ planetDatas: [planet] });

        const result: AnchorEvent.AnchorEvent | null = APPLIER.getNextAnchorEvent(playerData, TestDataBuilders.buildServerData());
        expect(result).not.toBeNull();
        expect(result!.type).toBe(AnchorEvent.AnchorEventType.BuildingUpgrade);
    });

    it('ignores fleet arrivals whose resolutionState is ResolveResultUnknown', () =>
    {
        const fleet: CoreType.FleetMovement = TestDataBuilders.buildFleetMovement(
        {
            fleetMovementRow: { started_at: BASE_TIME, duration_at_start_time: 10_000 },
            resolutionState: CoreType.FleetMovementResolution.ResolveResultUnknown,
        });
        const planet: CoreType.PlanetData = TestDataBuilders.buildPlanetData(
        {
            dynamicPlanetData: { futureFleetArrivals: [fleet] },
        });
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ planetDatas: [planet] });

        const result: AnchorEvent.AnchorEvent | null = APPLIER.getNextAnchorEvent(playerData, TestDataBuilders.buildServerData());
        expect(result).toBeNull();
    });

    it('picks the earliest across planets even when each planet has a different event type', () =>
    {
        const upgradeFar: CoreType.BuildingUpgrade = buildUpgradeAt(1, BASE_TIME + 50_000);
        const constructionNear: CoreType.UnitConstruction = buildConstructionAt(2, BASE_TIME + 5_000);

        const planet1: CoreType.PlanetData = TestDataBuilders.buildPlanetData(
        {
            planetRow: { id: 1 },
            dynamicPlanetData: { buildingUpgrades: [upgradeFar] },
        });
        const planet2: CoreType.PlanetData = TestDataBuilders.buildPlanetData(
        {
            planetRow: { id: 2 },
            dynamicPlanetData: { unitConstructions: [constructionNear] },
        });
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ planetDatas: [planet1, planet2] });

        const result: AnchorEvent.AnchorEvent | null = APPLIER.getNextAnchorEvent(playerData, TestDataBuilders.buildServerData());
        expect(result).not.toBeNull();
        expect(result!.type).toBe(AnchorEvent.AnchorEventType.UnitConstruction);
        expect(result!.time).toBe(BASE_TIME + 5_000);
    });
});
