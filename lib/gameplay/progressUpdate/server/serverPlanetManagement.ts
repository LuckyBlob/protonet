import * as DB from "@/lib/db/db";
import * as DBType from "@/lib/db/dbTypes";
import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as ServerType from "@/lib/gameplay/coreData/type/serverTypes";
import * as ServerProgress from "@/lib/gameplay/progressUpdate/server/serverProgress";
import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as StaticDataHelper from "@/lib/gameplay/coreData/static/staticDataHelpers";
import * as StaticData from "@/lib/gameplay/coreData/static/staticData";

function findFreePlanetAddress(minSlot: number, maxSlot:number): GameType.PlanetAddress | null
{
    const freeCoordinate: GameType.PlanetAddress | undefined = DB.databaseConnection.prepare
    (
        `WITH RECURSIVE
            galaxies(galaxy) AS (
                SELECT @galaxyMin
                UNION ALL SELECT galaxy + 1 FROM galaxies WHERE galaxy < @galaxyMax
            ),
            systems(system) AS (
                SELECT @systemMin
                UNION ALL SELECT system + 1 FROM systems WHERE system < @systemMax
            ),
            slots(slot) AS (
                SELECT @slotMin
                UNION ALL SELECT slot + 1 FROM slots WHERE slot < @slotMax
            )
            SELECT g.galaxy AS galaxy, s.system AS system, sl.slot AS slot, 1 AS zone
            FROM galaxies g
            CROSS JOIN systems s
            CROSS JOIN slots sl
            WHERE NOT EXISTS
            (
                SELECT 1 FROM planet p
                WHERE p.galaxy = g.galaxy AND p.system = s.system AND p.slot = sl.slot AND p.zone = 1
            )
            ORDER BY random()
            LIMIT 1`
    ).get({
        galaxyMin: 1,
        galaxyMax: StaticData.GALAXY_COUNT,
        systemMin: 1,
        systemMax: StaticData.SYSTEM_COUNT,
        slotMin: minSlot,
        slotMax: maxSlot,
    }) as GameType.PlanetAddress | undefined;

    return freeCoordinate ?? null;
}

export function claimPlanet(planetAddress: GameType.PlanetAddress | null, playerId: number, claimedAt: number): number
{
    const claimedPlanetId: number | null = DB.databaseConnection.transaction(() =>
    {
        const isNew: boolean = planetAddress === null;
        if (isNew)
        {
            planetAddress = findFreePlanetAddress(StaticData.MIN_SLOT_STARTING_PLANET, StaticData.MAX_SLOT_STARTING_PLANET);
        }

        if (planetAddress === null)
        {
            throw new Error("No more planets for new player.")
        }

        const claimedPlanet: { id: number } = DB.databaseConnection.prepare(
            "INSERT INTO planet (zone, slot, system, galaxy, size, owner_player_id, claimed_at, last_updated) VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id"
        ).get(
            planetAddress.zone,
            planetAddress.slot,
            planetAddress.system,
            planetAddress.galaxy,
            StaticData.STARTING_PLANET_SIZE,
            playerId,
            claimedAt,
            claimedAt
        ) as { id: number };

        let size: number = StaticData.STARTING_PLANET_SIZE;
        if (isNew === false)
        {
            const slotRow: { slot: number } = DB.databaseConnection.prepare(
                "SELECT slot FROM planet WHERE id = ?"
            ).get(claimedPlanet.id) as { slot: number };
            size = StaticDataHelper.rollSizeForSlot(slotRow.slot);
        }

        DB.databaseConnection.prepare(
            "UPDATE planet SET size = ?, owner_player_id = ?, claimed_at = ?, last_updated = ? WHERE id = ?"
        ).run(
            size,
            playerId,
            claimedAt,
            claimedAt,
            claimedPlanet.id
        );

        // do this last so the update fleet sees the new player target and acts accordingly
        DB.databaseConnection.prepare(
            "UPDATE fleet_movement SET player_target_id = ? WHERE planet_target_id = ?"
        ).run(playerId, claimedPlanet.id);

        return claimedPlanet.id;
    })();

    return claimedPlanetId;
}

// Creates a moon (zone=Moon planet row) at the exact coordinates of an existing planet — allowed by
// the widened UNIQUE(slot, system, galaxy, zone). Mirrors migration 018's backfill: copy the planet's
// coords/size/owner/timestamps. Size is cosmetic for now (a dedicated moon size formula comes later).
// An empty moon is valid: its dynamic rows simply don't exist yet and read as empty maps.
export function createMoonForPlanet(planetId: number, playerId: number, claimedAt: number): number
{
    const planetRow: DBType.PlanetRow | undefined = DB.databaseConnection.prepare(
        "SELECT * FROM planet WHERE id = ?"
    ).get(planetId) as DBType.PlanetRow | undefined;

    if (planetRow === undefined)
    {
        throw new Error(`Cannot create moon: planet ${planetId} does not exist.`);
    }

    // The moon reuses the planet's coordinates and size but sits in the Moon zone, owned by the same
    // player. Build the full row so every inserted column is sourced from one object rather than mixing
    // a bare Moon literal with the planet's fields.
    const moonRow: DBType.PlanetRow =
    {
        id: -1, // assigned by the DB on insert
        zone: GameType.PlanetZone.Moon,
        slot: planetRow.slot,
        system: planetRow.system,
        galaxy: planetRow.galaxy,
        size: planetRow.size,
        owner_player_id: playerId,
        claimed_at: claimedAt,
        last_updated: claimedAt,
    };

    const createdMoon: { id: number } = DB.databaseConnection.prepare(
        "INSERT INTO planet (zone, slot, system, galaxy, size, owner_player_id, claimed_at, last_updated) VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id"
    ).get(
        moonRow.zone,
        moonRow.slot,
        moonRow.system,
        moonRow.galaxy,
        moonRow.size,
        moonRow.owner_player_id,
        moonRow.claimed_at,
        moonRow.last_updated
    ) as { id: number };

    return createdMoon.id;
}

export function abandonPlanet(planetId: number, playerId: number): void
{
    const serverData: CoreType.ServerData = ServerType.getServerData();

    // applyPlayerUpdate detects inTransaction and skips starting a nested transaction,
    // so it is safe to call from inside the transaction below. Wrapping both operations
    // in one transaction eliminates the gap where a concurrent request could observe
    // post-progress state while the planet is still present.
    // set null first before clean so we fail the "target player null" condition and dont pickup to delete and not re-add.
    DB.databaseConnection.transaction(() =>
    {
        ServerProgress.applyPlayerUpdate(playerId, serverData, Date.now());

        const bodyIdsToAbandon: number[] = getBodyIdsToAbandon(planetId);

        for (const bodyId of bodyIdsToAbandon)
        {
            DB.databaseConnection.prepare(
                "UPDATE fleet_movement SET player_target_id = null, planet_target_id = null WHERE planet_target_id = ?"
            ).run(bodyId);

            DB.databaseConnection.prepare(
                "DELETE FROM fleet_movement WHERE planet_origin_id = ?"
            ).run(bodyId);

            DB.databaseConnection.prepare(
                "DELETE FROM planet WHERE id = ?"
            ).run(bodyId);
        }
    })();
}

// A planet and its moon (and later its debris field) all share one coordinate with no parent FK
// linking them, so abandoning a planet must delete every body at that coordinate in code. Abandoning
// a moon/debris removes only that body. Returns an empty list when the body is already gone (e.g. the
// delete-account loop reaches a moon after its planet's abandon already took it).
function getBodyIdsToAbandon(planetId: number): number[]
{
    type AbandonTargetRow = { id: number; zone: number; galaxy: number; system: number; slot: number };
    const targetRow: AbandonTargetRow | undefined = DB.databaseConnection.prepare(
        "SELECT id, zone, galaxy, system, slot FROM planet WHERE id = ?"
    ).get(planetId) as AbandonTargetRow | undefined;

    if (targetRow === undefined)
    {
        return [];
    }

    if (targetRow.zone !== GameType.PlanetZone.Planet)
    {
        return [targetRow.id];
    }

    const coordinateBodyRows: { id: number }[] = DB.databaseConnection.prepare(
        "SELECT id FROM planet WHERE galaxy = ? AND system = ? AND slot = ?"
    ).all(targetRow.galaxy, targetRow.system, targetRow.slot) as { id: number }[];

    return coordinateBodyRows.map((row: { id: number }): number => row.id);
}