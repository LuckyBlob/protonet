import * as DB from "@/lib/db/db";
import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as ServerType from "@/lib/gameplay/coreData/type/serverTypes";
import * as ServerProgress from "@/lib/gameplay/progressUpdate/server/serverProgress";
import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";


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
            SELECT g.galaxy AS galaxy, s.system AS system, sl.slot AS slot
            FROM galaxies g
            CROSS JOIN systems s
            CROSS JOIN slots sl
            WHERE NOT EXISTS
            (
                SELECT 1 FROM planet p
                WHERE p.galaxy = g.galaxy AND p.system = s.system AND p.slot = sl.slot
            )
            ORDER BY random()
            LIMIT 1`
    ).get({
        galaxyMin: 1,
        galaxyMax: GameType.GALAXY_COUNT,
        systemMin: 1,
        systemMax: GameType.SYSTEM_COUNT,
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
            planetAddress = findFreePlanetAddress(GameType.MIN_SLOT_STARTING_PLANET, GameType.MAX_SLOT_STARTING_PLANET);
        }

        if (planetAddress === null)
        {
            throw new Error("No more planets for new player.")
        }

        const claimedPlanet: { id: number } = DB.databaseConnection.prepare(
            "INSERT INTO planet (slot, system, galaxy, size, owner_player_id, claimed_at, last_updated) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id"
        ).get(
            planetAddress.slot,
            planetAddress.system,
            planetAddress.galaxy,
            GameType.STARTING_PLANET_SIZE,
            playerId,
            claimedAt,
            claimedAt
        ) as { id: number };

        let size: number = GameType.STARTING_PLANET_SIZE;
        if (isNew === false)
        {
            const slotRow: { slot: number } = DB.databaseConnection.prepare(
                "SELECT slot FROM planet WHERE id = ?"
            ).get(claimedPlanet.id) as { slot: number };
            size = GameType.rollSizeForSlot(slotRow.slot);
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

        DB.databaseConnection.prepare(
            "UPDATE fleet_movement SET player_target_id = null, planet_target_id = null WHERE planet_target_id = ?"
        ).run(planetId);

        DB.databaseConnection.prepare(
            "DELETE FROM fleet_movement WHERE planet_origin_id = ?"
        ).run(planetId);

        DB.databaseConnection.prepare(
            "DELETE FROM planet WHERE id = ?"
        ).run(planetId);
    })();
}