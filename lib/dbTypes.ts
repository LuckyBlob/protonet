export type PlayerRow =
{
	id: number;
	user_id: number;
	gold: number;
	production_rate: number;
	upgrade_level: number;
	last_updated: number;
};

export type UserRow =
{
	id: number;
	username: string;
	password_hash: string;
	created_at: number;
};

export type SessionRow =
{
	token: string;
	user_id: number;
	expires_at: number;
};