import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ReactElement } from 'react';

import * as TopBar from '@/components/layout/topBarElement';
import * as TestDataBuilders from '../helpers/testDataBuilders';
import * as CoreType from '@/lib/gameplay/coreData/type/coreTypes';
import * as GameType from '@/lib/gameplay/coreData/type/gameTypes';
import * as UseClientDataState from '@/lib/use/useClientDataState';

// Metal Storage level 0 = 5000 * floor(2.5 * e^0) = 10000 — the baseline cap when no storage building exists.
const METAL_BASELINE_CAP: number = 10000;
// Metal Storage level 1 = 5000 * floor(2.5 * e^(20/33)) = 20000.
const METAL_STORAGE_LEVEL_1_CAP: number = 20000;
const METAL_RATE_PER_HOUR: number = 33;

const RESOURCE_TYPES: GameType.ResourceType[] =
[
    GameType.ResourceType.Metal,
    GameType.ResourceType.Crystal,
    GameType.ResourceType.Deuterium,
];

function noop(): void
{
}

function buildClientDataStateResult(dynamicPlanetData: Partial<CoreType.DynamicPlanetData>): UseClientDataState.ClientDataStateResult
{
    const planetData: CoreType.PlanetData = TestDataBuilders.buildPlanetData(
    {
        planetRow: { id: 1 },
        dynamicPlanetData: dynamicPlanetData,
    });
    const playerData: CoreType.PlayerData = TestDataBuilders.buildPlayerData({ planetDatas: [planetData] });

    const playerState: CoreType.PlayerState =
    {
        dbData: playerData,
        predictedDBData: playerData,
        selectedPlanetId: planetData.planetRow.id,
        lastFetchTimestamp: 0,
    };

    const clientDataStateResult: UseClientDataState.ClientDataStateResult =
    {
        psController: [playerState, noop],
        sdsController: [TestDataBuilders.buildServerData(), noop],
        lsController: [{ isLoading: false, error: null }, noop],
    };

    return clientDataStateResult;
}

function getMetalDisplayValues(dynamicPlanetData: Partial<CoreType.DynamicPlanetData>): TopBar.PlanetResourceDisplayValues
{
    const clientDataStateResult: UseClientDataState.ClientDataStateResult = buildClientDataStateResult(dynamicPlanetData);
    const displayValues: TopBar.PlanetDisplayValues = TopBar.getPlanetDisplayValues(clientDataStateResult, RESOURCE_TYPES);

    const metalDisplayValues: TopBar.PlanetResourceDisplayValues | undefined = displayValues.resourceDisplayValues.find(
        (singleResourceDisplayValues: TopBar.PlanetResourceDisplayValues): boolean => singleResourceDisplayValues.resourceType === GameType.ResourceType.Metal);

    if (metalDisplayValues === undefined)
    {
        throw new Error(`Metal display values missing from the top bar.`);
    }

    return metalDisplayValues;
}

function renderTopBarHtml(dynamicPlanetData: Partial<CoreType.DynamicPlanetData>): string
{
    const clientDataStateResult: UseClientDataState.ClientDataStateResult = buildClientDataStateResult(dynamicPlanetData);

    const element: ReactElement = TopBar.TopBarElement(
    {
        clientDataStateResult: clientDataStateResult,
        planetSelector: <div />,
    });

    return renderToStaticMarkup(element);
}

describe('topBarElement — resource maximum is surfaced to the card (regression: max was never shown)', () =>
{
    it('exposes the storage maximum on each resource display value', () =>
    {
        const metalDisplayValues: TopBar.PlanetResourceDisplayValues = getMetalDisplayValues(
        {
            buildingLevels: new Map<GameType.BuildingType, number>([[GameType.BuildingType.MetalStorage, 1]]),
        });

        expect(metalDisplayValues.resourceMaximum).toBe(METAL_STORAGE_LEVEL_1_CAP);
    });

    it('renders the current / max pair in the resource card markup', () =>
    {
        const html: string = renderTopBarHtml(
        {
            resourceQuantity: new Map<GameType.ResourceType, number>
            ([
                [GameType.ResourceType.Metal, 1234],
                [GameType.ResourceType.Crystal, 0],
                [GameType.ResourceType.Deuterium, 0],
            ]),
            buildingLevels: new Map<GameType.BuildingType, number>([[GameType.BuildingType.MetalStorage, 1]]),
        });

        // "1234 / 20000" — current next to max, separated by a slash.
        expect(html).toMatch(/1234\s*\/\s*20000/);
    });
});

describe('topBarElement — no storage building falls back to the level-0 baseline (regression: was uncapped)', () =>
{
    it('reports the 10000 baseline maximum when there is no storage building', () =>
    {
        const metalDisplayValues: TopBar.PlanetResourceDisplayValues = getMetalDisplayValues(
        {
            buildingLevels: new Map<GameType.BuildingType, number>([[GameType.BuildingType.MetalMine, 1], [GameType.BuildingType.SolarPlant, 1]]),
        });

        expect(metalDisplayValues.resourceMaximum).toBe(METAL_BASELINE_CAP);
    });
});

describe('topBarElement — production rate reflects the cap (regression: still produced while capped)', () =>
{
    it('shows the real production rate while under the maximum', () =>
    {
        const metalDisplayValues: TopBar.PlanetResourceDisplayValues = getMetalDisplayValues(
        {
            // 2000 Metal, well under the 20000 cap, so the mine's 33/hr shows through.
            buildingLevels: new Map<GameType.BuildingType, number>([[GameType.BuildingType.MetalMine, 1], [GameType.BuildingType.SolarPlant, 1], [GameType.BuildingType.MetalStorage, 1]]),
        });

        expect(metalDisplayValues.productionRatePerHour).toBe(METAL_RATE_PER_HOUR);
    });

    it('shows 0/hr once the resource is at or over the maximum, even with a producing mine', () =>
    {
        const metalDisplayValues: TopBar.PlanetResourceDisplayValues = getMetalDisplayValues(
        {
            // 20000 Metal sits exactly at the level-1 storage cap, so production no longer accumulates.
            resourceQuantity: new Map<GameType.ResourceType, number>
            ([
                [GameType.ResourceType.Metal, METAL_STORAGE_LEVEL_1_CAP],
                [GameType.ResourceType.Crystal, 0],
                [GameType.ResourceType.Deuterium, 0],
            ]),
            buildingLevels: new Map<GameType.BuildingType, number>([[GameType.BuildingType.MetalMine, 1], [GameType.BuildingType.SolarPlant, 1], [GameType.BuildingType.MetalStorage, 1]]),
        });

        expect(metalDisplayValues.productionRatePerHour).toBe(0);
    });

    it('keeps producing while over the no-storage baseline would have been exceeded but storage was built', () =>
    {
        const metalDisplayValues: TopBar.PlanetResourceDisplayValues = getMetalDisplayValues(
        {
            // 12000 Metal is over the 10000 no-storage baseline, but a level-1 storage raises the cap to 20000,
            // so production should still show through. (Catches a cap that ignores the actual storage level.)
            resourceQuantity: new Map<GameType.ResourceType, number>
            ([
                [GameType.ResourceType.Metal, 12000],
                [GameType.ResourceType.Crystal, 0],
                [GameType.ResourceType.Deuterium, 0],
            ]),
            buildingLevels: new Map<GameType.BuildingType, number>([[GameType.BuildingType.MetalMine, 1], [GameType.BuildingType.SolarPlant, 1], [GameType.BuildingType.MetalStorage, 1]]),
        });

        expect(metalDisplayValues.productionRatePerHour).toBe(METAL_RATE_PER_HOUR);
    });
});

describe('topBarElement — resource card goes red when at or over the maximum (regression: never went red)', () =>
{
    it('renders the red class when a resource is over its maximum', () =>
    {
        const html: string = renderTopBarHtml(
        {
            // 15000 Metal with no storage: over the 10000 baseline cap.
            resourceQuantity: new Map<GameType.ResourceType, number>
            ([
                [GameType.ResourceType.Metal, 15000],
                [GameType.ResourceType.Crystal, 0],
                [GameType.ResourceType.Deuterium, 0],
            ]),
            buildingLevels: new Map<GameType.BuildingType, number>(),
        });

        expect(html).toContain('text-red-500');
    });

    it('does not render the red class when every resource is under its maximum', () =>
    {
        const html: string = renderTopBarHtml(
        {
            // All resources comfortably under the 10000 baseline cap.
            resourceQuantity: new Map<GameType.ResourceType, number>
            ([
                [GameType.ResourceType.Metal, 100],
                [GameType.ResourceType.Crystal, 100],
                [GameType.ResourceType.Deuterium, 100],
            ]),
            buildingLevels: new Map<GameType.BuildingType, number>(),
        });

        expect(html).not.toContain('text-red-500');
    });
});
