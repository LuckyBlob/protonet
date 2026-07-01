import { describe, it, expect } from 'vitest';
import * as GameType from '@/lib/gameplay/coreData/type/gameTypes';
import * as CoreType from '@/lib/gameplay/coreData/type/coreTypes';
import * as PendingRepairData from '@/lib/gameplay/dynamicData/planet/pendingRepairData';
import * as TestDataBuilders from '../helpers/testDataBuilders';

const THIRTY_MINUTES_MS: number = 30 * 60 * 1000;
const TWELVE_HOURS_MS: number = 12 * 60 * 60 * 1000;
const SEVENTY_TWO_HOURS_MS: number = 72 * 60 * 60 * 1000;

function buildPlanetWithDock(repairDockLevel: number, pendingRepairs: CoreType.PendingRepair[]): CoreType.PlanetData
{
    const buildingLevels: Map<GameType.BuildingType, number> = new Map<GameType.BuildingType, number>([[GameType.BuildingType.RepairDock, repairDockLevel]]);
    return TestDataBuilders.buildPlanetData(
    {
        dynamicPlanetData:
        {
            buildingLevels: buildingLevels,
            pendingRepairs: pendingRepairs,
        },
    });
}

describe('pendingRepairData', () =>
{
    it('buildPendingRepair starts as an unrepaired wreck holding the given ships', () =>
    {
        const wreckUnits: Map<GameType.UnitType, number> = new Map<GameType.UnitType, number>([[GameType.UnitType.SmallTransport, 25]]);
        const pendingRepair: CoreType.PendingRepair = PendingRepairData.buildPendingRepair(7, 3, 1000, wreckUnits);

        expect(pendingRepair.pendingRepairRow.planet_id).toBe(7);
        expect(pendingRepair.pendingRepairRow.player_id).toBe(3);
        expect(pendingRepair.pendingRepairRow.created_at).toBe(1000);
        expect(pendingRepair.pendingRepairRow.repair_started_at).toBeNull();
        expect(pendingRepair.pendingRepairRow.repair_completes_at).toBeNull();
        expect(PendingRepairData.isWreckAwaitingRepair(pendingRepair)).toBe(true);
        expect(PendingRepairData.getPendingRepairUnitQuantities(pendingRepair).get(GameType.UnitType.SmallTransport)).toBe(25);
    });

    it('computeRepairDurationMs floors tiny repairs at 30 minutes', () =>
    {
        const serverData: CoreType.ServerData = TestDataBuilders.buildServerData(1);
        const pendingRepair: CoreType.PendingRepair = PendingRepairData.buildPendingRepair(1, 1, 0, new Map<GameType.UnitType, number>([[GameType.UnitType.EspionageProbe, 1]]));
        const planetData: CoreType.PlanetData = buildPlanetWithDock(1, [pendingRepair]);

        expect(PendingRepairData.computeRepairDurationMs(pendingRepair, planetData, serverData)).toBe(THIRTY_MINUTES_MS);
    });

    it('computeRepairDurationMs caps huge repairs at 12 hours', () =>
    {
        const serverData: CoreType.ServerData = TestDataBuilders.buildServerData(1);
        const pendingRepair: CoreType.PendingRepair = PendingRepairData.buildPendingRepair(1, 1, 0, new Map<GameType.UnitType, number>([[GameType.UnitType.SmallTransport, 100000]]));
        const planetData: CoreType.PlanetData = buildPlanetWithDock(1, [pendingRepair]);

        expect(PendingRepairData.computeRepairDurationMs(pendingRepair, planetData, serverData)).toBe(TWELVE_HOURS_MS);
    });

    it('canStartRepair requires a Repair Dock, an unrepaired wreck, and no other repair in progress', () =>
    {
        const now: number = 10_000_000;
        const wreck: CoreType.PendingRepair = PendingRepairData.buildPendingRepair(1, 1, now, new Map<GameType.UnitType, number>([[GameType.UnitType.SmallTransport, 10]]));

        const planetWithDock: CoreType.PlanetData = buildPlanetWithDock(1, [wreck]);
        expect(PendingRepairData.canStartRepair(planetWithDock, wreck, now)).toBe(true);

        const planetWithoutDock: CoreType.PlanetData = buildPlanetWithDock(0, [wreck]);
        expect(PendingRepairData.canStartRepair(planetWithoutDock, wreck, now)).toBe(false);
    });

    it('walks the wreck lifecycle from repairing to ready and blocks a second concurrent repair', () =>
    {
        const now: number = 10_000_000;
        const serverData: CoreType.ServerData = TestDataBuilders.buildServerData(1);
        const wreck: CoreType.PendingRepair = PendingRepairData.buildPendingRepair(1, 1, now, new Map<GameType.UnitType, number>([[GameType.UnitType.SmallTransport, 10]]));
        const planetData: CoreType.PlanetData = buildPlanetWithDock(1, [wreck]);

        PendingRepairData.startRepair(wreck, planetData, serverData, now);
        expect(wreck.pendingRepairRow.repair_started_at).toBe(now);
        expect(PendingRepairData.isWreckAwaitingRepair(wreck)).toBe(false);
        expect(PendingRepairData.isRepairing(wreck, now)).toBe(true);
        expect(PendingRepairData.isAnyRepairInProgress(planetData, now)).toBe(true);

        const completesAt: number = wreck.pendingRepairRow.repair_completes_at ?? 0;
        expect(PendingRepairData.isRepairReady(wreck, completesAt)).toBe(true);
        expect(PendingRepairData.canCollectRepair(wreck, completesAt)).toBe(true);
        expect(PendingRepairData.canCollectRepair(wreck, now)).toBe(false);

        const secondWreck: CoreType.PendingRepair = PendingRepairData.buildPendingRepair(1, 1, now, new Map<GameType.UnitType, number>([[GameType.UnitType.SmallTransport, 5]]));
        planetData.dynamicPlanetData.pendingRepairs.push(secondWreck);
        expect(PendingRepairData.canStartRepair(planetData, secondWreck, now)).toBe(false);
    });

    it('getBurnUpTime applies only to unrepaired wrecks; getAutoCollectTime only after a repair starts', () =>
    {
        const now: number = 5_000_000;
        const serverData: CoreType.ServerData = TestDataBuilders.buildServerData(1);
        const wreck: CoreType.PendingRepair = PendingRepairData.buildPendingRepair(1, 1, now, new Map<GameType.UnitType, number>([[GameType.UnitType.SmallTransport, 10]]));

        expect(PendingRepairData.getBurnUpTime(wreck)).toBe(now + SEVENTY_TWO_HOURS_MS);
        expect(PendingRepairData.getAutoCollectTime(wreck)).toBeNull();

        const planetData: CoreType.PlanetData = buildPlanetWithDock(1, [wreck]);
        PendingRepairData.startRepair(wreck, planetData, serverData, now);

        expect(PendingRepairData.getBurnUpTime(wreck)).toBeNull();
        const completesAt: number = wreck.pendingRepairRow.repair_completes_at ?? 0;
        expect(PendingRepairData.getAutoCollectTime(wreck)).toBe(completesAt + SEVENTY_TWO_HOURS_MS);
    });

    it('removePendingRepair drops the matching row', () =>
    {
        const wreck: CoreType.PendingRepair = PendingRepairData.buildPendingRepair(1, 1, 0, new Map<GameType.UnitType, number>([[GameType.UnitType.SmallTransport, 10]]));
        wreck.pendingRepairRow.id = 42;
        const planetData: CoreType.PlanetData = buildPlanetWithDock(1, [wreck]);

        PendingRepairData.removePendingRepair(planetData, 42);
        expect(planetData.dynamicPlanetData.pendingRepairs.length).toBe(0);
    });

    it('canBurnWreckField is allowed only when no repair is in progress on the planet', () =>
    {
        const now: number = 10_000_000;
        const serverData: CoreType.ServerData = TestDataBuilders.buildServerData(1);
        const wreck: CoreType.PendingRepair = PendingRepairData.buildPendingRepair(1, 1, now, new Map<GameType.UnitType, number>([[GameType.UnitType.SmallTransport, 10]]));
        const planetData: CoreType.PlanetData = buildPlanetWithDock(1, [wreck]);

        expect(PendingRepairData.canBurnWreckField(planetData, now)).toBe(true);

        PendingRepairData.startRepair(wreck, planetData, serverData, now);
        expect(PendingRepairData.canBurnWreckField(planetData, now)).toBe(false);
    });
});
