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
	last_updated: number;
	building_upgrade_completes_at: number;
	building_being_upgraded: number;
	ship_construction_batch_completes_at: number;
	current_ship_construction_batch_id: number;
};

export type PublicPlanetRow =
{
	id: number;
	slot: number;
	system: number;
	galaxy: number;
	owner_player_id: number | null;
};

export type PlanetShipRow  =
{
    planet_id: number;
    ship_type: number;
    ship_quantity: number;
};

export type ShipConstructionRow   =
{
    id: number;
    planet_id: number;
    batch_id : number;
    ship_type: number;
    ship_quantity: number;
    queue_order: number;
};