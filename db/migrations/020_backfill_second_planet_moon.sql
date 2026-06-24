-- Backfill a moon (zone=2) on each owner's TWO oldest zone=1 planets, matching new-player
-- creation which now gives a moon to both starting planets. Migration 018 §17 only backfilled the
-- FIRST planet's moon, so existing players are missing the moon on their second planet.
--
-- Pure INSERT, no rebuild: a moon row reuses the planet's coords/size/owner/timestamps and sits at
-- the same coordinates with zone=2 (allowed by the widened UNIQUE from 018). Idempotent — the
-- NOT EXISTS guard skips any (coords) that already has a zone=2 moon, so the first planet's moon
-- from 018 is left untouched and re-running is safe. An empty moon is valid: its dynamic rows
-- simply do not exist yet and read as empty maps.
--
-- "Two oldest" matches getPlanetsByOwner ordering (claimed_at ASC, id ASC) so the two starting
-- planets are the ones moon-ed; later colonized planets get no moon (parity with claimPlanet).

INSERT INTO planet (zone, slot, system, galaxy, size, owner_player_id, claimed_at, last_updated)
    SELECT 2, p.slot, p.system, p.galaxy, p.size, p.owner_player_id, p.claimed_at, p.last_updated
    FROM (
        SELECT id, slot, system, galaxy, size, owner_player_id, claimed_at, last_updated,
               ROW_NUMBER() OVER (PARTITION BY owner_player_id ORDER BY claimed_at ASC, id ASC) AS owner_planet_rank
        FROM planet
        WHERE zone = 1 AND owner_player_id IS NOT NULL
    ) p
    WHERE p.owner_planet_rank <= 2
      AND NOT EXISTS (
          SELECT 1 FROM planet m
          WHERE m.zone = 2 AND m.slot = p.slot AND m.system = p.system AND m.galaxy = p.galaxy
      );
