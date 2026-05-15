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

export type PlanetRow =
{
	id: number;
	slot: number;
	system: number;
	galaxy: number;
	size: number;
	owner_player_id: number | null;
	claimed_at: number;
	ressource_1: number;
	ressource_1_production_level: number;
	last_updated: number;
	building_upgrade_completes_at: number;
	building_being_upgraded: number;
};

export type PublicPlanetRow =
{
	id: number;
	slot: number;
	system: number;
	galaxy: number;
	owner_player_id: number | null;
};