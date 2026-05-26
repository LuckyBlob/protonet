export type PlayerRow =
{
	id: number;
	user_id: number;
	gold: number;
	upgrade_level: number;
	building_upgrade_completes_at: number;
	last_updated: number;
};

export type UserRow =
{
	id: number;
	username: string;
	password_hash: string;
	admin_level: number;
	created_at: number;
};

export type SessionRow =
{
	token: string;
	user_id: number;
	expires_at: number;
};

export type ServerConfigRow =
{
	id: number;
	time_multiplier: number;
};

export type PlanetResourceRow =
{
	planet_id: number;
	resource_type: number;
	resource_quantity: number;
};

export type PlanetBuildingRow =
{
	planet_id: number;
	building_type: number;
	building_level: number;
};

export type PlanetRow =
{
	id: number;
	slot: number;
	system: number;
	galaxy: number;
	size: number;
	owner_player_id: number | null;
	claimed_at: number;
	released_at: number;
	last_updated: number;
	building_upgrade_completes_at: number;
	building_being_upgraded: number;
	ship_construction_completes_at: number;
	current_ship_construction_id: number;
};

export type PublicPlanetRow =
{
	id: number;
	slot: number;
	system: number;
	galaxy: number;
	owner_player_id: number;
};

export type PublicPlayerRow =
{
	id: number;
	username: string;
};

export type PlanetShipRow =
{
    planet_id: number;
    ship_type: number;
    ship_quantity: number;
};

export type ShipConstructionRow =
{
    id: number;
    planet_id: number;
    requested_at: number;
    duration_at_request_time: number;
    duration_at_start_time: number | null;
    started_at: number | null;
	current_ship_construction_ship_row_id: number | null;
};

export type ShipConstructionShipRow =
{
    id: number,
	ship_construction_id: number;
    ship_type: number;
    ship_quantity: number;
};

export type BuildingUpgradeRow =
{
    id: number;
    planet_id: number;
    requested_at: number;
    duration_at_request_time: number;
    duration_at_start_time: number | null;
    started_at: number | null;
	current_building_upgrade_building_row_id: number | null;
};

export type BuildingUpgradeBuildingRow =
{
    id: number;
    building_upgrade_id: number;
    building_type: number;
};

export type FleetMovementRow =
{
    id: number;
    seed: number;
    player_origin_id: number;
    planet_origin_id: number;
    player_target_id: number | null; // == 0 for colonizing
    planet_target_id: number;
    is_return_trip: number;
    fleet_action_type: number;
    requested_at: number;
    duration_at_request_time: number;
    duration_at_start_time: number | null;
    started_at: number | null;
};

export type FleetMovementShipRow =
{
    fleet_id: number;
    ship_type: number;
    ship_quantity: number;
};

export type FleetMovementResourceRow =
{
    fleet_id: number;
    resource_type: number;
    resource_quantity: number;
};
