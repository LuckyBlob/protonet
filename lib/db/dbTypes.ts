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
	player_id: number;
	resource_type: number;
	resource_quantity: number;
};

export type PlanetBuildingRow =
{
	planet_id: number;
	player_id: number;
	building_type: number;
	building_level: number;
	energy_percentage: number;
};

export type PlanetRow =
{
	id: number;
	zone: number;
	slot: number;
	system: number;
	galaxy: number;
	size: number;
	temperature: number;
	name: string | null;
	owner_player_id: number | null;
	claimed_at: number;
	last_updated: number;
};

export type PublicPlayerRow =
{
	id: number;
	username: string;
};

export type PlanetShipRow =
{
    planet_id: number;
    player_id: number;
    ship_type: number;
    ship_quantity: number;
};

export type ShipConstructionRow =
{
    id: number;
    planet_id: number;
    player_id: number;
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
    player_id: number;
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

export type PlayerResearchRow =
{
	player_id: number;
	research_type: number;
	research_level: number;
};

export type CurrentlyResearchingRow =
{
    id: number;
    player_id: number;
    requested_at: number;
    duration_at_request_time: number;
    duration_at_start_time: number | null;
    started_at: number | null;
	current_currently_researching_research_row_id: number | null;
};

export type CurrentlyResearchingResearchRow =
{
    id: number;
    currently_researching_id: number;
    research_type: number;
};

export type FleetMovementRow =
{
    id: number;
    seed: number;
    player_origin_id: number;
    planet_origin_id: number;
	planet_origin_zone: number;
	planet_origin_slot: number;
	planet_origin_system: number;
	planet_origin_galaxy: number;
    player_target_id: number | null; // intended target owner; the target planet is re-derived by coords at arrival
	planet_target_zone: number;
	planet_target_slot: number;
	planet_target_system: number;
	planet_target_galaxy: number;
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

export type FleetMovementFuelRow =
{
    fleet_id: number;
    resource_type: number;
    resource_quantity: number;
};

export type MessageRow =
{
	id: number;
	player_id: number;
	received_at: number;
	type: number;
	is_read: number;
	title: string;
	body: string;
}