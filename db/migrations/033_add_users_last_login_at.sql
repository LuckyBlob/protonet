ALTER TABLE users ADD COLUMN last_login_at INTEGER NOT NULL DEFAULT 0;

-- Backfill: the best "last seen" we have historically is the player's last_updated (bumped on their
-- last progress); fall back to account creation time for users that have no player row yet.
UPDATE users SET last_login_at = COALESCE((SELECT player.last_updated FROM player WHERE player.user_id = users.id), created_at);
