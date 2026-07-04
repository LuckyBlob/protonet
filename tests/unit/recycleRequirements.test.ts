import { describe, it, expect } from 'vitest';
import * as Requirement from '@/lib/gameplay/coreData/requirement/requirements';
import * as RequirementValueGetters from '@/lib/gameplay/coreData/requirement/requirementValueGetters';
import * as RequirementType from '@/lib/gameplay/coreData/requirement/requirementTypes';
import * as GameType from '@/lib/gameplay/coreData/type/gameTypes';
import * as CoreType from '@/lib/gameplay/coreData/type/coreTypes';
import * as StaticDataHelper from '@/lib/gameplay/coreData/static/staticDataHelpers';
import * as TestDataBuilders from '../helpers/testDataBuilders';

describe('canUnitTargetDebrisField', () =>
{
    it('is true for the Recycler and false for transports', () =>
    {
        expect(StaticDataHelper.canUnitTargetDebrisField(GameType.UnitType.Recycler)).toBe(true);
        expect(StaticDataHelper.canUnitTargetDebrisField(GameType.UnitType.SmallTransport)).toBe(false);
        expect(StaticDataHelper.canUnitTargetDebrisField(GameType.UnitType.ColonyShip)).toBe(false);
    });
});

describe('allFleetUnitsCanTargetDebrisField requirement getter', () =>
{
    it('returns 1 when every unit in the fleet is debris-capable', () =>
    {
        const getter: (context: RequirementType.RequirementContext) => number = TestDataBuilders.bindGetter(RequirementValueGetters.ALL_FLEET_UNITS_CAN_TARGET_DEBRIS_FIELD.valueGetter);
        const context: RequirementType.RequirementContext =
        {
            playerData: TestDataBuilders.buildPlayerData(),
            planetId: 1,
            unitQuantities: new Map<GameType.UnitType, number>([[GameType.UnitType.Recycler, 5]]),
        };
        expect(getter(context)).toBe(1);
    });

    it('returns 0 when any unit in the fleet is not debris-capable', () =>
    {
        const getter: (context: RequirementType.RequirementContext) => number = TestDataBuilders.bindGetter(RequirementValueGetters.ALL_FLEET_UNITS_CAN_TARGET_DEBRIS_FIELD.valueGetter);
        const context: RequirementType.RequirementContext =
        {
            playerData: TestDataBuilders.buildPlayerData(),
            planetId: 1,
            unitQuantities: new Map<GameType.UnitType, number>([[GameType.UnitType.Recycler, 5], [GameType.UnitType.SmallTransport, 1]]),
        };
        expect(getter(context)).toBe(0);
    });

    it('ignores zero-quantity unit types', () =>
    {
        const getter: (context: RequirementType.RequirementContext) => number = TestDataBuilders.bindGetter(RequirementValueGetters.ALL_FLEET_UNITS_CAN_TARGET_DEBRIS_FIELD.valueGetter);
        const context: RequirementType.RequirementContext =
        {
            playerData: TestDataBuilders.buildPlayerData(),
            planetId: 1,
            unitQuantities: new Map<GameType.UnitType, number>([[GameType.UnitType.Recycler, 5], [GameType.UnitType.SmallTransport, 0]]),
        };
        expect(getter(context)).toBe(1);
    });

    it('throws when there is no fleet (unitQuantities undefined)', () =>
    {
        const getter: (context: RequirementType.RequirementContext) => number = TestDataBuilders.bindGetter(RequirementValueGetters.ALL_FLEET_UNITS_CAN_TARGET_DEBRIS_FIELD.valueGetter);
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

    const recyclerFleet: Map<GameType.UnitType, number> = new Map<GameType.UnitType, number>([[GameType.UnitType.Recycler, 1]]);
    const noResources: Map<GameType.ResourceType, number> = new Map<GameType.ResourceType, number>();

    const debrisTarget: GameType.PlanetAddress = { galaxy: 2, system: 5, slot: 3, zone: GameType.PlanetZone.DebrisField };
    const debrisOwnerId: number = 2;

    it('passes for an all-Recycler fleet targeting an occupied slot that has a debris field', () =>
    {
        const player: CoreType.PlayerData = buildRecyclingPlayer();

        const failed: RequirementType.Requirement[] = Requirement.getFailedFleetMovementRequirements({ playerData: player, planetId: 1, unitQuantities: recyclerFleet, transportedResourceQuantities: noResources, targetPlanetAddress: debrisTarget, zoneAssociatedPlanetOwnerPlayerId: debrisOwnerId, targetZoneExists: true }, GameType.FleetActionType.Recycle);
        expect(failed.length).toBe(0);
    });

    it('passes when the slot is occupied but the debris field does not yet exist', () =>
    {
        const player: CoreType.PlayerData = buildRecyclingPlayer();

        const failed: RequirementType.Requirement[] = Requirement.getFailedFleetMovementRequirements({ playerData: player, planetId: 1, unitQuantities: recyclerFleet, transportedResourceQuantities: noResources, targetPlanetAddress: debrisTarget, zoneAssociatedPlanetOwnerPlayerId: debrisOwnerId, targetZoneExists: false }, GameType.FleetActionType.Recycle);
        expect(failed.length).toBe(0);
    });

    it('fails when the slot is not occupied (no associated planet owner)', () =>
    {
        const player: CoreType.PlayerData = buildRecyclingPlayer();

        const failed: RequirementType.Requirement[] = Requirement.getFailedFleetMovementRequirements({ playerData: player, planetId: 1, unitQuantities: recyclerFleet, transportedResourceQuantities: noResources, targetPlanetAddress: debrisTarget, zoneAssociatedPlanetOwnerPlayerId: null, targetZoneExists: false }, GameType.FleetActionType.Recycle);
        expect(failed.length).toBeGreaterThan(0);
    });

    it('fails when the target zone is not a debris field', () =>
    {
        const player: CoreType.PlayerData = buildRecyclingPlayer();
        const planetTarget: GameType.PlanetAddress = { galaxy: 2, system: 5, slot: 3, zone: GameType.PlanetZone.Planet };

        const failed: RequirementType.Requirement[] = Requirement.getFailedFleetMovementRequirements({ playerData: player, planetId: 1, unitQuantities: recyclerFleet, transportedResourceQuantities: noResources, targetPlanetAddress: planetTarget, zoneAssociatedPlanetOwnerPlayerId: debrisOwnerId, targetZoneExists: true }, GameType.FleetActionType.Recycle);
        expect(failed.length).toBeGreaterThan(0);
    });

    it('fails when the fleet contains a non-debris-capable unit', () =>
    {
        const player: CoreType.PlayerData = buildRecyclingPlayer();
        const mixedFleet: Map<GameType.UnitType, number> = new Map<GameType.UnitType, number>([[GameType.UnitType.Recycler, 1], [GameType.UnitType.SmallTransport, 1]]);

        const failed: RequirementType.Requirement[] = Requirement.getFailedFleetMovementRequirements({ playerData: player, planetId: 1, unitQuantities: mixedFleet, transportedResourceQuantities: noResources, targetPlanetAddress: debrisTarget, zoneAssociatedPlanetOwnerPlayerId: debrisOwnerId, targetZoneExists: true }, GameType.FleetActionType.Recycle);
        expect(failed.length).toBeGreaterThan(0);
    });
});
