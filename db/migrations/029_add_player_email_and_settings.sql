-- Adds email + verification to accounts, a token table for email verification / password reset,
-- and a per-player settings table (first setting: probes-per-send in the galaxy view).
--
-- Existing accounts predate the email requirement, so they are grandfathered as verified with a
-- NULL email; only NEW registrations require an email and go through verification.

ALTER TABLE users ADD COLUMN email TEXT;
ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN verify_token TEXT;
ALTER TABLE users ADD COLUMN reset_token TEXT;

UPDATE users SET email_verified = 1;

-- Unique only among non-null emails, so the many grandfathered NULL rows don't collide.
CREATE UNIQUE INDEX idx_users_email ON users(email) WHERE email IS NOT NULL;

CREATE TABLE player_settings
(
    player_id INTEGER PRIMARY KEY,
    probes_per_send INTEGER NOT NULL DEFAULT 1,
    FOREIGN KEY (player_id) REFERENCES player(id) ON DELETE CASCADE
);

-- Backfill a default settings row for every existing player so the row is always present.
INSERT INTO player_settings (player_id, probes_per_send)
    SELECT id, 1 FROM player;
