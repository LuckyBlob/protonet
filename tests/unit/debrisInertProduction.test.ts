import { describe, it, expect } from 'vitest';
import * as ApplyProgress from '@/lib/gameplay/progressUpdate/applyProgress';
import * as CoreType from '@/lib/gameplay/coreData/type/coreTypes';
import * as GameType from '@/lib/gameplay/coreData/type/gameTypes';
import * as ResourceData from '@/lib/gameplay/dynamicData/planet/resourceData';
import * as TestDataBuilders from '../helpers/testDataBuilders';

describe('updateResourcesToTime — non-producing zones are inert', () =>
{
    it('accrues nothing on DebrisField or Moon zones, while a Planet still produces', () =>
    {
        const lastUpdated: number = 1_000_000;
        const oneHourLater: number = lastUpdated + 3_600_000;

        const debrisPlanet: CoreType.PlanetData = TestDataBuilders.buildPlanetData(
        {
            planetRow: { id: 1, zone: GameType.PlanetZone.DebrisField, last_updated: lastUpdated },
            dynamicPlanetData: { resourceQuantity: new Map<GameType.ResourceType, number>([[GameType.ResourceType.Metal, 5_000]]) },
        });
        const moonPlanet: CoreType.PlanetData = TestDataBuilders.buildPlanetData(
        {
            planetRow: { id: 2, zone: GameType.PlanetZone.Moon, last_updated: lastUpdated },
            dynamicPlanetData: { resourceQuantity: new Map<GameType.ResourceType, number>([[GameType.ResourceType.Metal, 5_000]]) },
        });
        const normalPlanet: CoreType.PlanetData = TestDataBuilders.buildPlanetData(
        {
            planetRow: { id: 3, zone: GameType.PlanetZone.Planet, last_updated: lastUpdated },
            dynamicPlanetData: { resourceQuantity: new Map<GameType.ResourceType, number>([[GameType.ResourceType.Metal, 5_000]]) },
        });
        const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ planetDatas: [debrisPlanet, moonPlanet, normalPlanet] });
        const serverData: CoreType.ServerData = TestDataBuilders.buildServerData();

        ApplyProgress.updateResourcesToTime(playerData, serverData, oneHourLater);

        expect(ResourceData.getResourceQuantity(debrisPlanet, GameType.ResourceType.Metal)).toBe(5_000);
        expect(ResourceData.getResourceQuantity(moonPlanet, GameType.ResourceType.Metal)).toBe(5_000);
        expect(ResourceData.getResourceQuantity(normalPlanet, GameType.ResourceType.Metal)).toBeGreaterThan(5_000);
    });
});
