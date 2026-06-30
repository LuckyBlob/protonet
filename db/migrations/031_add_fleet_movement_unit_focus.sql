-- unit_focus: the preferred enemy unit type a missile-launch fleet should destroy first (a UnitType value;
-- the launch UI offers Defense-category types only). NULL = no preference, and is the value for every
-- non-missile fleet action. Pure ADD COLUMN, no rebuild; appended last in physical column order — every
-- INSERT/SELECT in code uses explicit column lists or SELECT * read into a keyed object, never a positional
-- INSERT ... SELECT * copy (see the migration 014 column-order trap).

ALTER TABLE fleet_movement ADD COLUMN unit_focus INTEGER;
