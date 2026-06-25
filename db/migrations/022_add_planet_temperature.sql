-- Add a per-body `temperature`, stored in KELVIN (= Celsius + 273) so a value is always positive and
-- can never be mistaken for a "consumption" in the planet-value system; it is shown back to the player
-- in Celsius. Temperature is rolled from the planet's slot at creation and currently only scales
-- Deuterium Synthesizer output (colder = more deuterium); Solar Satellite is not implemented yet.
--
-- Pure ADD COLUMN, no rebuild. Existing zone=1 planets are backfilled with a per-slot random roll
-- mirroring StaticDataHelper.rollTemperatureForSlot / StaticData.SLOT_TEMPERATURE_RANGES (Celsius ranges
-- below, each + KELVIN_OFFSET 273). Moons and debris keep the DEFAULT 273 (= 0 Celsius); temperature is
-- only consumed on the planet zone for now.
--
-- min + (ABS(RANDOM()) % (max - min + 1)) yields a uniform integer in [min, max].

ALTER TABLE planet ADD COLUMN temperature INTEGER NOT NULL DEFAULT 273;

UPDATE planet SET temperature = 393 + (ABS(RANDOM()) % 141) WHERE zone = 1 AND slot = 1; -- 120..260 C
UPDATE planet SET temperature = 323 + (ABS(RANDOM()) % 61)  WHERE zone = 1 AND slot = 2; -- 50..110 C
UPDATE planet SET temperature = 293 + (ABS(RANDOM()) % 61)  WHERE zone = 1 AND slot = 3; -- 20..80 C
UPDATE planet SET temperature = 263 + (ABS(RANDOM()) % 61)  WHERE zone = 1 AND slot = 4; -- -10..50 C
UPDATE planet SET temperature = 143 + (ABS(RANDOM()) % 141) WHERE zone = 1 AND slot = 5; -- -130..10 C
