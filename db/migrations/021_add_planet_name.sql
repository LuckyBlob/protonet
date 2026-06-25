-- Add a player-settable display name to each body (planet/moon/debris). Nullable: a NULL name means
-- "use the computed default" (the coordinate label, see StaticDataHelper.getPlanetDisplayName), so we
-- do not backfill — every existing row keeps NULL and renders exactly as it did before.
--
-- Pure ADD COLUMN, no rebuild. `name` is appended LAST in physical column order; that is fine because
-- every INSERT/SELECT in code uses explicit column lists (createZone) or column-name mapping (SELECT *
-- read into a keyed object), never a positional INSERT ... SELECT * copy.

ALTER TABLE planet ADD COLUMN name TEXT;
