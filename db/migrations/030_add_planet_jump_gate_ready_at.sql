-- Jump Gate cooldown: epoch-ms timestamp before which this moon's Jump Gate cannot fire again. A jump
-- sets it on BOTH the source and destination moon to now + computeJumpGateCooldownSeconds(thatGateLevel)
-- (scaled by the server time_multiplier). DEFAULT 0 = ready immediately, so every existing moon can jump
-- at once. Only meaningful on the Moon zone (only moons can build a Jump Gate); other zones keep 0.
--
-- Pure ADD COLUMN, no rebuild. Appended LAST in physical column order — fine because every INSERT/SELECT
-- in code uses explicit column lists (createZone) or SELECT * read into a keyed object, never a positional
-- INSERT ... SELECT * copy (see the migration 014 column-order trap).

ALTER TABLE planet ADD COLUMN jump_gate_ready_at INTEGER NOT NULL DEFAULT 0;
