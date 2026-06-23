import { describe, it, expect } from 'vitest';
import * as Requirement from '@/lib/gameplay/coreData/requirement/requirements';
import * as RequirementValueGetters from '@/lib/gameplay/coreData/requirement/requirementValueGetters';
import * as RequirementType from '@/lib/gameplay/coreData/requirement/requirementTypes';
import * as GameType from '@/lib/gameplay/coreData/type/gameTypes';
import * as CoreType from '@/lib/gameplay/coreData/type/coreTypes';
import * as StaticDataHelper from '@/lib/gameplay/coreData/static/staticDataHelpers';
import * as TestDataBuilders from '../helpers/testDataBuilders';

describe('canShipTargetDebrisField', () =>
{
    it('is true for the Recycler and false for transports', () =>
    {
        expect(StaticDataHelper.canShipTargetDebrisField(GameType.ShipType.Recycler)).toBe(true);
        expect(StaticDataHelper.canShipTargetDebrisField(GameType.ShipType.SmallTransport)).toBe(false);
        expect(StaticDataHelper.canShipTargetDebrisField(GameType.ShipType.ColonyShip)).toBe(false);
    });
});

describe('allFleetShipsCanTargetDebrisField requirement getter', () =>
{
    it('returns 1 when every ship in the fleet is debris-capable', () =>
    {
        const getter: RequirementType.ThingValueGetter = RequirementValueGetters.allFleetShipsCanTargetDebrisField();
        const context: RequirementType.RequirementContext =
        {
            playerData: TestDataBuilders.buildPlayerData(),
            planetId: 1,
            shipQuantities: new Map<GameType.ShipType, number>([[GameType.ShipType.Recycler, 5]]),
        };
        expect(getter(context)).toBe(1);
    });

    it('returns 0 when any ship in the fleet is not debris-capable', () =>
    {
        const getter: RequirementType.ThingValueGetter = RequirementValueGetters.allFleetShipsCanTargetDebrisField();
        const context: RequirementType.RequirementContext =
        {
            playerData: TestDataBuilders.buildPlayerData(),
            planetId: 1,
            shipQuantities: new Map<GameType.ShipType, number>([[GameType.ShipType.Recycler, 5], [GameType.ShipType.SmallTransport, 1]]),
        };
        expect(getter(context)).toBe(0);
    });

    it('ignores zero-quantity ship types', () =>
    {
        const getter: RequirementType.ThingValueGetter = RequirementValueGetters.allFleetShipsCanTargetDebrisField();
        const context: RequirementType.RequirementContext =
        {
            playerData: TestDataBuilders.buildPlayerData(),
            planetId: 1,
            shipQuantities: new Map<GameType.ShipType, number>([[GameType.ShipType.Recycler, 5], [GameType.ShipType.SmallTransport, 0]]),
        };
        expect(getter(context)).toBe(1);
    });

    it('throws when there is no fleet (shipQuantities undefined)', () =>
    {
        const getter: RequirementType.ThingValueGetter = RequirementValueGetters.allFleetShipsCanTargetDebrisField();
        const context: RequirementType.RequirementContext =
        {
            playerData: TestDataBuilders.buildPlayerData(),
            planetId: 1,
        };
        expect(() => getter(context)).toThrow();
    });
});

describe('Recycle fleet requirements', () =>
{
    function buildRecyclingPlayer(): CoreType.PlayerData
    {
        const planet: CoreType.PlanetData = TestDataBuilders.buildPlanetData({ planetRow: { id: 1 } });
        return TestDataBuilders.buildPlayerData({ playerRow: { id: 1 }, planetDatas: [planet] });
    }

    const recyclerFleet: Map<GameType.ShipType, number> = new Map<GameType.ShipType, number>([[GameType.ShipType.Recycler, 1]]);
    const noResources: Map<GameType.ResourceType, number> = new Map<GameType.ResourceType, number>();

    const debrisTarget: GameType.PlanetAddress = { galaxy: 2, system: 5, slot: 3, zone: GameType.PlanetZone.DebrisField };
    const debrisOwnerId: number = 2;

    it('passes for an all-Recycler fleet targeting an existing (owned) debris field', () =>
    {
        const player: CoreType.PlayerData = buildRecyclingPlayer();

        const failed: RequirementType.Requirement[] = Requirement.getFailedFleetMovementRequirements(player, GameType.FleetActionType.Recycle, 1, recyclerFleet, noResources, debrisTarget, debrisOwnerId, true);
        expect(failed.length).toBe(0);
    });

    it('passes when targeting a not-yet-existing debris field (like colonize to an empty slot)', () =>
    {
        const player: CoreType.PlayerData = buildRecyclingPlayer();

        const failed: RequirementType.Requirement[] = Requirement.getFailedFleetMovementRequirements(player, GameType.FleetActionType.Recycle, 1, recyclerFleet, noResources, debrisTarget, null, false);
        expect(failed.length).toBe(0);
    });

    it('fails when the target zone is not a debris field', () =>
    {
        const player: CoreType.PlayerData = buildRecyclingPlayer();
        const planetTarget: GameType.PlanetAddress = { galaxy: 2, system: 5, slot: 3, zone: GameType.PlanetZone.Planet };

        const failed: RequirementType.Requirement[] = Requirement.getFailedFleetMovementRequirements(player, GameType.FleetActionType.Recycle, 1, recyclerFleet, noResources, planetTarget, debrisOwnerId, true);
        expect(failed.length).toBeGreaterThan(0);
    });

    it('fails when the fleet contains a non-debris-capable ship', () =>
    {
        const player: CoreType.PlayerData = buildRecyclingPlayer();
        const mixedFleet: Map<GameType.ShipType, number> = new Map<GameType.ShipType, number>([[GameType.ShipType.Recycler, 1], [GameType.ShipType.SmallTransport, 1]]);

        const failed: RequirementType.Requirement[] = Requirement.getFailedFleetMovementRequirements(player, GameType.FleetActionType.Recycle, 1, mixedFleet, noResources, debrisTarget, debrisOwnerId, true);
        expect(failed.length).toBeGreaterThan(0);
    });
});
