import { describe, it, expect } from 'vitest';
import * as MissileSpaceData from '@/lib/gameplay/dynamicData/planet/missileSpaceData';
import * as UnitConstructionData from '@/lib/gameplay/dynamicData/planet/unitConstructionData';
import * as CoreType from '@/lib/gameplay/coreData/type/coreTypes';
import * as GameType from '@/lib/gameplay/coreData/type/gameTypes';
import * as DBType from '@/lib/db/dbTypes';
import * as TestDataBuilders from '../helpers/testDataBuilders';

function buildPlanetAndPlayer(overrides: Partial<CoreType.DynamicPlanetData>): { planet: CoreType.PlanetData; playerData: CoreType.PlayerData; }
{
    const planet: CoreType.PlanetData = TestDataBuilders.buildPlanetData({ dynamicPlanetData: overrides });
    const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ planetDatas: [planet] });

    return { planet: planet, playerData: playerData };
}

function queuedMissiles(unitType: GameType.UnitType, quantity: number): CoreType.UnitConstruction
{
    const unitRow: DBType.UnitConstructionUnitRow = { id: 1, unit_construction_id: 1, unit_type: unitType, unit_quantity: quantity };
    const constructionRow: DBType.UnitConstructionRow =
    {
        id: 1, planet_id: 1, player_id: 1, requested_at: 0, duration_at_request_time: 0, duration_at_start_time: null, started_at: null, current_unit_construction_unit_row_id: null,
    };

    return { unitConstructionRow: constructionRow, unitConstructionUnitRows: [unitRow] };
}

describe('missile space capacity', () =>
{
    it('capacity is Missile Silo level x 10 space', () =>
    {
        const built: { planet: CoreType.PlanetData; playerData: CoreType.PlayerData; } = buildPlanetAndPlayer({ buildingLevels: new Map([[GameType.BuildingType.MissileSilo, 5]]) });
        expect(MissileSpaceData.computeMissileSpaceCapacity(built.planet, built.playerData)).toBe(50);
    });

    it('capacity is 0 with no Missile Silo', () =>
    {
        const built: { planet: CoreType.PlanetData; playerData: CoreType.PlayerData; } = buildPlanetAndPlayer({});
        expect(MissileSpaceData.computeMissileSpaceCapacity(built.planet, built.playerData)).toBe(0);
    });

    it('used space counts owned missiles by space cost (ICBM=2, Interceptor=1)', () =>
    {
        const built: { planet: CoreType.PlanetData; playerData: CoreType.PlayerData; } = buildPlanetAndPlayer({
            buildingLevels: new Map([[GameType.BuildingType.MissileSilo, 5]]),
            unitQuantity: new Map([[GameType.UnitType.InterplanetaryMissile, 3], [GameType.UnitType.InterceptorMissile, 5]]),
        });
        // 3*2 + 5*1 = 11
        expect(MissileSpaceData.computeUsedMissileSpace(built.planet, built.playerData)).toBe(11);
        expect(MissileSpaceData.computeFreeMissileSpace(built.planet, built.playerData)).toBe(39);
    });

    it('used space also counts queued (in-construction) missiles', () =>
    {
        const built: { planet: CoreType.PlanetData; playerData: CoreType.PlayerData; } = buildPlanetAndPlayer({
            buildingLevels: new Map([[GameType.BuildingType.MissileSilo, 5]]),
            unitQuantity: new Map([[GameType.UnitType.InterceptorMissile, 5]]),
            unitConstructions: [queuedMissiles(GameType.UnitType.InterplanetaryMissile, 2)],
        });
        // owned 5*1 + queued 2*2 = 9
        expect(MissileSpaceData.computeUsedMissileSpace(built.planet, built.playerData)).toBe(9);
    });

    it('free space never goes negative when over capacity', () =>
    {
        const built: { planet: CoreType.PlanetData; playerData: CoreType.PlayerData; } = buildPlanetAndPlayer({
            buildingLevels: new Map([[GameType.BuildingType.MissileSilo, 1]]),
            unitQuantity: new Map([[GameType.UnitType.InterplanetaryMissile, 20]]),
        });
        expect(MissileSpaceData.computeFreeMissileSpace(built.planet, built.playerData)).toBe(0);
    });
});

describe('computeMaxStorableMissileQuantities', () =>
{
    it('caps an ICBM request to floor(freeSpace / 2)', () =>
    {
        const built: { planet: CoreType.PlanetData; playerData: CoreType.PlayerData; } = buildPlanetAndPlayer({ buildingLevels: new Map([[GameType.BuildingType.MissileSilo, 1]]) });
        const storable: Map<GameType.UnitType, number> = MissileSpaceData.computeMaxStorableMissileQuantities(built.planet, built.playerData, new Map([[GameType.UnitType.InterplanetaryMissile, 10]]));
        expect(storable.get(GameType.UnitType.InterplanetaryMissile)).toBe(5); // 10 space / 2 per ICBM
    });

    it('caps interceptors to free space one-for-one', () =>
    {
        const built: { planet: CoreType.PlanetData; playerData: CoreType.PlayerData; } = buildPlanetAndPlayer({ buildingLevels: new Map([[GameType.BuildingType.MissileSilo, 1]]) });
        const storable: Map<GameType.UnitType, number> = MissileSpaceData.computeMaxStorableMissileQuantities(built.planet, built.playerData, new Map([[GameType.UnitType.InterceptorMissile, 100]]));
        expect(storable.get(GameType.UnitType.InterceptorMissile)).toBe(10);
    });

    it('allocates remaining space across a mixed request (ICBM first consumes the budget)', () =>
    {
        const built: { planet: CoreType.PlanetData; playerData: CoreType.PlayerData; } = buildPlanetAndPlayer({ buildingLevels: new Map([[GameType.BuildingType.MissileSilo, 1]]) });
        const request: Map<GameType.UnitType, number> = new Map([[GameType.UnitType.InterplanetaryMissile, 10], [GameType.UnitType.InterceptorMissile, 10]]);
        const storable: Map<GameType.UnitType, number> = MissileSpaceData.computeMaxStorableMissileQuantities(built.planet, built.playerData, request);
        expect(storable.get(GameType.UnitType.InterplanetaryMissile)).toBe(5); // 5*2 = 10 space used
        expect(storable.has(GameType.UnitType.InterceptorMissile)).toBe(false); // no space left
    });

    it('returns empty when storage is already full', () =>
    {
        const built: { planet: CoreType.PlanetData; playerData: CoreType.PlayerData; } = buildPlanetAndPlayer({
            buildingLevels: new Map([[GameType.BuildingType.MissileSilo, 1]]),
            unitQuantity: new Map([[GameType.UnitType.InterceptorMissile, 10]]),
        });
        const storable: Map<GameType.UnitType, number> = MissileSpaceData.computeMaxStorableMissileQuantities(built.planet, built.playerData, new Map([[GameType.UnitType.InterceptorMissile, 5]]));
        expect(storable.size).toBe(0);
    });
});

describe('computeMaxAffordableUnitQuantities for missiles', () =>
{
    it('caps by available resources', () =>
    {
        // One ICBM costs 12500 metal / 2500 crystal / 10000 deuterium. Enough for exactly 2.
        const planet: CoreType.PlanetData = TestDataBuilders.buildPlanetData({ dynamicPlanetData: {
            resourceQuantity: new Map([[GameType.ResourceType.Metal, 25000], [GameType.ResourceType.Crystal, 5000], [GameType.ResourceType.Deuterium, 20000]]),
        }});
        const affordable: Map<GameType.UnitType, number> = UnitConstructionData.computeMaxAffordableUnitQuantities(planet, new Map([[GameType.UnitType.InterplanetaryMissile, 10]]));
        expect(affordable.get(GameType.UnitType.InterplanetaryMissile)).toBe(2);
    });
});
