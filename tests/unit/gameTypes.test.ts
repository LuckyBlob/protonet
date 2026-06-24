import { describe, it, expect } from 'vitest';
import * as GameType from '@/lib/gameplay/coreData/type/gameTypes';
import * as StaticDataHelper from '@/lib/gameplay/coreData/static/staticDataHelpers';
import * as ThingType from '@/lib/gameplay/coreData/thing/thingTypes';

describe('getDistance', () =>
{
    it('returns 0 for the same address', () =>
    {
        const address: GameType.PlanetAddress = { galaxy: 1, system: 1, slot: 1, zone: GameType.PlanetZone.Planet };
        expect(StaticDataHelper.getDistance(address, address)).toBe(0);
    });

    it('computes slot-only difference (same galaxy, same system)', () =>
    {
        const origin: GameType.PlanetAddress = { galaxy: 1, system: 1, slot: 1, zone: GameType.PlanetZone.Planet };
        const target: GameType.PlanetAddress = { galaxy: 1, system: 1, slot: 3, zone: GameType.PlanetZone.Planet };
        // 1000 + 2*5 = 1010
        expect(StaticDataHelper.getDistance(origin, target)).toBe(1010);
    });

    it('returns the planet-to-moon distance for the same coordinate, different zone', () =>
    {
        const planet: GameType.PlanetAddress = { galaxy: 1, system: 1, slot: 1, zone: GameType.PlanetZone.Planet };
        const moon: GameType.PlanetAddress = { galaxy: 1, system: 1, slot: 1, zone: GameType.PlanetZone.Moon };
        expect(StaticDataHelper.getDistance(planet, moon)).toBe(5);
        expect(StaticDataHelper.getDistance(moon, planet)).toBe(5);
    });

    it('computes system difference (same galaxy, ignores slot)', () =>
    {
        const origin: GameType.PlanetAddress = { galaxy: 1, system: 1, slot: 1, zone: GameType.PlanetZone.Planet };
        const target: GameType.PlanetAddress = { galaxy: 1, system: 5, slot: 4, zone: GameType.PlanetZone.Planet };
        // 2700 + 4*95 = 3080 (slot difference ignored when system differs)
        expect(StaticDataHelper.getDistance(origin, target)).toBe(3080);
    });

    it('computes galaxy difference (ignores system and slot)', () =>
    {
        const origin: GameType.PlanetAddress = { galaxy: 1, system: 1, slot: 1, zone: GameType.PlanetZone.Planet };
        const target: GameType.PlanetAddress = { galaxy: 2, system: 10, slot: 5, zone: GameType.PlanetZone.Planet };
        // 1 * 20000 = 20000 (system and slot ignored when galaxy differs)
        expect(StaticDataHelper.getDistance(origin, target)).toBe(20000);
    });

    it('is symmetric', () =>
    {
        const a: GameType.PlanetAddress = { galaxy: 1, system: 3, slot: 2, zone: GameType.PlanetZone.Planet };
        const b: GameType.PlanetAddress = { galaxy: 1, system: 10, slot: 4, zone: GameType.PlanetZone.Planet };
        expect(StaticDataHelper.getDistance(a, b)).toBe(StaticDataHelper.getDistance(b, a));
    });

    it('uses absolute galaxy difference', () =>
    {
        const a: GameType.PlanetAddress = { galaxy: 2, system: 1, slot: 1, zone: GameType.PlanetZone.Planet };
        const b: GameType.PlanetAddress = { galaxy: 1, system: 1, slot: 1, zone: GameType.PlanetZone.Planet };
        expect(StaticDataHelper.getDistance(a, b)).toBe(20000);
    });
});

describe('isSameAddress', () =>
{
    it('returns true for identical addresses', () =>
    {
        const address: GameType.PlanetAddress = { galaxy: 2, system: 5, slot: 3, zone: GameType.PlanetZone.Planet };
        expect(StaticDataHelper.isSameAddress(address, address)).toBe(true);
    });

    it('returns false when galaxy differs', () =>
    {
        const base: GameType.PlanetAddress = { galaxy: 1, system: 1, slot: 1, zone: GameType.PlanetZone.Planet };
        expect(StaticDataHelper.isSameAddress(base, { galaxy: 2, system: 1, slot: 1, zone: GameType.PlanetZone.Planet })).toBe(false);
    });

    it('returns false when system differs', () =>
    {
        const base: GameType.PlanetAddress = { galaxy: 1, system: 1, slot: 1, zone: GameType.PlanetZone.Planet };
        expect(StaticDataHelper.isSameAddress(base, { galaxy: 1, system: 2, slot: 1, zone: GameType.PlanetZone.Planet })).toBe(false);
    });

    it('returns false when slot differs', () =>
    {
        const base: GameType.PlanetAddress = { galaxy: 1, system: 1, slot: 1, zone: GameType.PlanetZone.Planet };
        expect(StaticDataHelper.isSameAddress(base, { galaxy: 1, system: 1, slot: 2, zone: GameType.PlanetZone.Planet })).toBe(false);
    });

    it('returns false when only the zone differs (planet vs moon at one coordinate)', () =>
    {
        const base: GameType.PlanetAddress = { galaxy: 1, system: 1, slot: 1, zone: GameType.PlanetZone.Planet };
        expect(StaticDataHelper.isSameAddress(base, { galaxy: 1, system: 1, slot: 1, zone: GameType.PlanetZone.Moon })).toBe(false);
    });
});

describe('isBuildableOnZone', () =>
{
    it('allows only the listed zones (Planet-only)', () =>
    {
        const planetOnly: GameType.PlanetZone[] = [GameType.PlanetZone.Planet];
        expect(StaticDataHelper.isBuildableOnZone(planetOnly, GameType.PlanetZone.Planet)).toBe(true);
        expect(StaticDataHelper.isBuildableOnZone(planetOnly, GameType.PlanetZone.Moon)).toBe(false);
        expect(StaticDataHelper.isBuildableOnZone(planetOnly, GameType.PlanetZone.DebrisField)).toBe(false);
    });

    it('allows exactly the listed zones', () =>
    {
        const planetAndMoon: GameType.PlanetZone[] = [GameType.PlanetZone.Planet, GameType.PlanetZone.Moon];
        expect(StaticDataHelper.isBuildableOnZone(planetAndMoon, GameType.PlanetZone.Planet)).toBe(true);
        expect(StaticDataHelper.isBuildableOnZone(planetAndMoon, GameType.PlanetZone.Moon)).toBe(true);
        expect(StaticDataHelper.isBuildableOnZone(planetAndMoon, GameType.PlanetZone.DebrisField)).toBe(false);
    });
});

describe('BUILDING_STATS moon-buildable set', () =>
{
    it('marks exactly the OGame moon buildings as Moon-buildable', () =>
    {
        const moonBuildable: GameType.BuildingType[] =
        [
            GameType.BuildingType.RoboticFactory,
            GameType.BuildingType.Shipyard,
            GameType.BuildingType.MetalStorage,
            GameType.BuildingType.CrystalContainement,
            GameType.BuildingType.DeuteriumTank,
        ];

        for (const buildingType of StaticDataHelper.getAllSpecificThings(ThingType.Thing.Building))
        {
            const buildableZones: GameType.PlanetZone[] = StaticDataHelper.getBuildingStats(buildingType).buildableZones;
            const expectedOnMoon: boolean = moonBuildable.includes(buildingType);
            expect(StaticDataHelper.isBuildableOnZone(buildableZones, GameType.PlanetZone.Moon)).toBe(expectedOnMoon);
            // Every building must still be buildable on a Planet.
            expect(StaticDataHelper.isBuildableOnZone(buildableZones, GameType.PlanetZone.Planet)).toBe(true);
        }
    });
});

describe('formatPlanetAddress', () =>
{
    it('produces "[g:s:p]" formatted output', () =>
    {
        expect(StaticDataHelper.formatPlanetAddress(1, 5, 3, GameType.PlanetZone.Planet)).toBe("[1:5:3]");
    });

    it('uses the values as-is without padding', () =>
    {
        expect(StaticDataHelper.formatPlanetAddress(2, 20, 5, GameType.PlanetZone.Planet)).toBe("[2:20:5]");
    });

    it('appends the zone display name for a moon', () =>
    {
        expect(StaticDataHelper.formatPlanetAddress(1, 5, 3, GameType.PlanetZone.Moon)).toBe("[1:5:3] (Moon)");
    });

    it('appends the zone display name for a debris field', () =>
    {
        expect(StaticDataHelper.formatPlanetAddress(1, 5, 3, GameType.PlanetZone.DebrisField)).toBe("[1:5:3] (Debris Field)");
    });

    it('throws on an unknown/missing zone', () =>
    {
        expect(() => StaticDataHelper.formatPlanetAddress(1, 5, 3, 999 as GameType.PlanetZone)).toThrow();
    });
});

describe('getPlanetZoneInfo', () =>
{
    it('returns the info for each known zone', () =>
    {
        expect(StaticDataHelper.getPlanetZoneInfo(GameType.PlanetZone.Planet).isSelectable).toBe(true);
        expect(StaticDataHelper.getPlanetZoneInfo(GameType.PlanetZone.Moon).isSelectable).toBe(true);
        expect(StaticDataHelper.getPlanetZoneInfo(GameType.PlanetZone.DebrisField).isSelectable).toBe(false);
    });

    it('marks the moon and debris field as non-producing, the planet as producing', () =>
    {
        expect(StaticDataHelper.getPlanetZoneInfo(GameType.PlanetZone.Planet).canProduceResources).toBe(true);
        expect(StaticDataHelper.getPlanetZoneInfo(GameType.PlanetZone.Moon).canProduceResources).toBe(false);
        expect(StaticDataHelper.getPlanetZoneInfo(GameType.PlanetZone.DebrisField).canProduceResources).toBe(false);
    });

    it('throws on an unknown/missing zone', () =>
    {
        expect(() => StaticDataHelper.getPlanetZoneInfo(999 as GameType.PlanetZone)).toThrow();
    });
});

describe('getPlayerName', () =>
{
    it('returns "Unknown" when playerId is null', () =>
    {
        expect(StaticDataHelper.getPlayerName([], null)).toBe("Unknown");
    });

    it('returns "Unknown" when playerId is not in the public rows', () =>
    {
        const rows = [{ id: 1, username: "Alice" }];
        expect(StaticDataHelper.getPlayerName(rows, 42)).toBe("Unknown");
    });

    it('returns the matching username when a public row exists', () =>
    {
        const rows = [{ id: 1, username: "Alice" }, { id: 2, username: "Bob" }];
        expect(StaticDataHelper.getPlayerName(rows, 2)).toBe("Bob");
    });
});

describe('rollSizeForSlot', () =>
{
    const SLOT_RANGES: { min: number; max: number; }[] =
    [
        { min: 40,  max: 70  },
        { min: 120, max: 310 },
        { min: 125, max: 255 },
        { min: 75,  max: 125 },
        { min: 60,  max: 90  },
    ];

    it('returns a size within the valid range for each slot', () =>
    {
        for (let slot: number = 1; slot <= 5; slot++)
        {
            const range: { min: number; max: number; } = SLOT_RANGES[slot - 1]!;

            for (let trial: number = 0; trial < 30; trial++)
            {
                const size: number = StaticDataHelper.rollSizeForSlot(slot);
                expect(size).toBeGreaterThanOrEqual(range.min);
                expect(size).toBeLessThanOrEqual(range.max);
            }
        }
    });
});
