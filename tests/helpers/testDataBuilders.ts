import * as DBType from "@/lib/db/dbTypes";
import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as StaticData from "@/lib/gameplay/coreData/static/staticData";

export function buildPlayerRow(overrides?: Partial<DBType.PlayerRow>): DBType.PlayerRow
{
    const playerRow: DBType.PlayerRow =
    {
        id: 1,
        user_id: 1,
        gold: 0,
        upgrade_level: 0,
        building_upgrade_completes_at: 0,
        last_updated: 1_000_000,
        ...overrides,
    };

    return playerRow;
}

export function buildPlanetRow(overrides?: Partial<DBType.PlanetRow>): DBType.PlanetRow
{
    const planetRow: DBType.PlanetRow =
    {
        id: 1,
        zone: 1,
        slot: 3,
        system: 1,
        galaxy: 1,
        size: StaticData.STARTING_PLANET_SIZE,
        owner_player_id: 1,
        claimed_at: 0,
        last_updated: 1_000_000,
        ...overrides,
    };

    return planetRow;
}

export function buildDynamicPlanetData(overrides?: Partial<CoreType.DynamicPlanetData>): CoreType.DynamicPlanetData
{
    const dynamicPlanetData: CoreType.DynamicPlanetData =
    {
        resourceQuantity: new Map<GameType.ResourceType, number>
        ([
            [GameType.ResourceType.Metal, 2000],
            [GameType.ResourceType.Crystal, 500],
            [GameType.ResourceType.Deuterium, 0],
        ]),
        buildingLevels: new Map<GameType.BuildingType, number>(),
        buildingEnergySettings: new Map<GameType.BuildingType, number>(),
        shipQuantity: new Map<GameType.ShipType, number>
        ([
            [GameType.ShipType.SmallTransport, 0],
            [GameType.ShipType.LargeTransport, 0],
        ]),
        shipConstructions: [],
        futureFleetArrivals: [],
        buildingUpgrades: [],
        ...overrides,
    };

    return dynamicPlanetData;
}

export function buildDynamicPlayerData(overrides?: Partial<CoreType.DynamicPlayerData>): CoreType.DynamicPlayerData
{
    const dynamicPlayerData: CoreType.DynamicPlayerData =
    {
        researchLevels: new Map<GameType.ResearchType, number>(),
        currentlyResearchings: [],
        messageDatas: [],
        ...overrides,
    };

    return dynamicPlayerData;
}

export function buildPlanetData(overrides?: { planetRow?: Partial<DBType.PlanetRow>; dynamicPlanetData?: Partial<CoreType.DynamicPlanetData>; }): CoreType.PlanetData
{
    const planetData: CoreType.PlanetData =
    {
        planetRow: buildPlanetRow(overrides?.planetRow),
        dynamicPlanetData: buildDynamicPlanetData(overrides?.dynamicPlanetData),
    };

    return planetData;
}

export function buildPlayerData(overrides?: { playerRow?: Partial<DBType.PlayerRow>; dynamicPlayerData?: CoreType.DynamicPlayerData; planetDatas?: CoreType.PlanetData[]; }): CoreType.PlayerData
{
    const playerData: CoreType.PlayerData =
    {
        playerRow: buildPlayerRow(overrides?.playerRow),
        dynamicPlayerData: overrides?.dynamicPlayerData ?? buildDynamicPlayerData(),
        planetDatas: overrides?.planetDatas ?? [buildPlanetData()],
        publicPlanetRows: [],
        publicPlayerRows: [],
    };

    return playerData;
}

export function buildServerData(timeMultiplier?: number): CoreType.ServerData
{
    const serverData: CoreType.ServerData =
    {
        config:
        {
            id: 1,
            time_multiplier: timeMultiplier ?? 1,
        },
    };

    return serverData;
}

export function buildBuildingUpgradeRow(overrides?: Partial<DBType.BuildingUpgradeRow>): DBType.BuildingUpgradeRow
{
    const row: DBType.BuildingUpgradeRow =
    {
        id: 1,
        planet_id: 1,
        player_id: 1,
        requested_at: 1_000_000,
        duration_at_request_time: 10_000,
        duration_at_start_time: 10_000,
        started_at: 1_000_000,
        current_building_upgrade_building_row_id: 1,
        ...overrides,
    };

    return row;
}

export function buildBuildingUpgradeBuildingRow(overrides?: Partial<DBType.BuildingUpgradeBuildingRow>): DBType.BuildingUpgradeBuildingRow
{
    const row: DBType.BuildingUpgradeBuildingRow =
    {
        id: 1,
        building_upgrade_id: 1,
        building_type: GameType.BuildingType.MetalMine,
        ...overrides,
    };

    return row;
}

export function buildCurrentlyResearchingRow(overrides?: Partial<DBType.CurrentlyResearchingRow>): DBType.CurrentlyResearchingRow
{
    const row: DBType.CurrentlyResearchingRow =
    {
        id: 1,
        player_id: 1,
        requested_at: 1_000_000,
        duration_at_request_time: 10_000,
        duration_at_start_time: 10_000,
        started_at: 1_000_000,
        current_currently_researching_research_row_id: 1,
        ...overrides,
    };

    return row;
}

export function buildCurrentlyResearchingResearchRow(overrides?: Partial<DBType.CurrentlyResearchingResearchRow>): DBType.CurrentlyResearchingResearchRow
{
    const row: DBType.CurrentlyResearchingResearchRow =
    {
        id: 1,
        currently_researching_id: 1,
        research_type: GameType.ResearchType.ImpulseDrive,
        ...overrides,
    };

    return row;
}

export function buildCurrentlyResearching(overrides?: { currentlyResearchingRow?: Partial<DBType.CurrentlyResearchingRow>; currentlyResearchingResearchRows?: DBType.CurrentlyResearchingResearchRow[]; }): CoreType.CurrentlyResearching
{
    const currentlyResearching: CoreType.CurrentlyResearching =
    {
        currentlyResearchingRow: buildCurrentlyResearchingRow(overrides?.currentlyResearchingRow),
        currentlyResearchingResearchRows: overrides?.currentlyResearchingResearchRows ?? [buildCurrentlyResearchingResearchRow()],
    };

    return currentlyResearching;
}

export function buildShipConstructionRow(overrides?: Partial<DBType.ShipConstructionRow>): DBType.ShipConstructionRow
{
    const row: DBType.ShipConstructionRow =
    {
        id: 1,
        planet_id: 1,
        player_id: 1,
        requested_at: 1_000_000,
        duration_at_request_time: 10_000,
        duration_at_start_time: 10_000,
        started_at: 1_000_000,
        current_ship_construction_ship_row_id: 1,
        ...overrides,
    };

    return row;
}

export function buildShipConstructionShipRow(overrides?: Partial<DBType.ShipConstructionShipRow>): DBType.ShipConstructionShipRow
{
    const row: DBType.ShipConstructionShipRow =
    {
        id: 1,
        ship_construction_id: 1,
        ship_type: GameType.ShipType.SmallTransport,
        ship_quantity: 1,
        ...overrides,
    };

    return row;
}

export function buildFleetMovementRow(overrides?: Partial<DBType.FleetMovementRow>): DBType.FleetMovementRow
{
    const row: DBType.FleetMovementRow =
    {
        id: 1,
        seed: 0,
        player_origin_id: 1,
        planet_origin_id: 1,
        planet_origin_zone: 1,
        planet_origin_slot: 3,
        planet_origin_system: 1,
        planet_origin_galaxy: 1,
        player_target_id: 2,
        planet_target_id: 2,
        planet_target_zone: 1,
        planet_target_slot: 4,
        planet_target_system: 1,
        planet_target_galaxy: 1,
        is_return_trip: 0,
        fleet_action_type: GameType.FleetActionType.Station,
        requested_at: 1_000_000,
        duration_at_request_time: 10_000,
        duration_at_start_time: 10_000,
        started_at: 1_000_000,
        ...overrides,
    };

    return row;
}

export function buildFleetMovementShipRow(overrides?: Partial<DBType.FleetMovementShipRow>): DBType.FleetMovementShipRow
{
    const row: DBType.FleetMovementShipRow =
    {
        fleet_id: 1,
        ship_type: GameType.ShipType.SmallTransport,
        ship_quantity: 1,
        ...overrides,
    };

    return row;
}

export function buildFleetMovementResourceRow(overrides?: Partial<DBType.FleetMovementResourceRow>): DBType.FleetMovementResourceRow
{
    const row: DBType.FleetMovementResourceRow =
    {
        fleet_id: 1,
        resource_type: GameType.ResourceType.Metal,
        resource_quantity: 0,
        ...overrides,
    };

    return row;
}

export type FleetMovementOverrides =
{
    fleetMovementRow?: Partial<DBType.FleetMovementRow>;
    fleetMovementShipRows?: DBType.FleetMovementShipRow[];
    fleetMovementResourceRows?: DBType.FleetMovementResourceRow[];
    fleetMovementFuelRows?: DBType.FleetMovementFuelRow[];
    resolutionState?: CoreType.FleetMovementResolution;
    originMessageRow?: DBType.MessageRow | null;
    targetMessageRow?: DBType.MessageRow | null;
};

export function buildFleetMovement(overrides?: FleetMovementOverrides): CoreType.FleetMovement
{
    const fleetMovement: CoreType.FleetMovement =
    {
        fleetMovementRow: buildFleetMovementRow(overrides?.fleetMovementRow),
        fleetMovementShipRows: overrides?.fleetMovementShipRows ?? [buildFleetMovementShipRow()],
        fleetMovementResourceRows: overrides?.fleetMovementResourceRows ?? [],
        fleetMovementFuelRows: overrides?.fleetMovementFuelRows ?? [],
        resolutionState: overrides?.resolutionState ?? CoreType.FleetMovementResolution.Unresolved,
        originMessageRow: overrides?.originMessageRow ?? null,
        targetMessageRow: overrides?.targetMessageRow ?? null,
    };

    return fleetMovement;
}

export function buildPublicPlayerRow(overrides?: Partial<DBType.PublicPlayerRow>): DBType.PublicPlayerRow
{
    const row: DBType.PublicPlayerRow =
    {
        id: 1,
        username: "Player1",
        ...overrides,
    };

    return row;
}

export function buildPublicPlanetRow(overrides?: Partial<DBType.PublicPlanetRow>): DBType.PublicPlanetRow
{
    const row: DBType.PublicPlanetRow =
    {
        id: 1,
        slot: 3,
        system: 1,
        galaxy: 1,
        owner_player_id: 1,
        ...overrides,
    };

    return row;
}
