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

        const size: number = isNew ? StaticData.STARTING_PLANET_SIZE : StaticDataHelper.rollSizeForSlot(planetAddress.slot);
        const newPlanetId: number = createZone(planetAddress, playerId, size, claimedAt);

        return newPlanetId;
    })();

    return claimedPlanetId;
}

export function createZone(planetAddress: GameType.PlanetAddress, ownerPlayerId: number, size: number, claimedAt: number): number
{
    const createdRow: { id: number } = DB.databaseConnection.prepare(
        "INSERT INTO planet (zone, slot, system, galaxy, size, owner_player_id, claimed_at, last_updated) VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id"
    ).get(
        planetAddress.zone,
        planetAddress.slot,
        planetAddress.system,
        planetAddress.galaxy,
        size,
        ownerPlayerId,
        claimedAt,
        claimedAt
    ) as { id: number };

    return createdRow.id;
}

export function abandonPlanet(planetId: number, playerId: number): void
{
    const serverData: CoreType.ServerData = ServerType.getServerData();

    DB.databaseConnection.transaction(() =>
    {
        ServerProgress.applyPlayerUpdate(playerId, serverData, Date.now());

        nullifyInboundFleetTargetsForPlanetAbandon(planetId);

        const zoneIdsToAbandon: number[] = getZoneIdsToAbandon(planetId);

        for (const zoneId of zoneIdsToAbandon)
        {
            deleteZone(zoneId);
        }
    })();
}

// Abandoning a PLANET wipes the whole coordinate, so inbound fleets heading there lose their target.
// Null their player_target_id so resolution bounces them home via the generic first guard. This is
// essential for CROSS-PLAYER fleets: those defer (ResolveResultUnknown) and re-resolve by loading the
// target player, whose zone is now gone — without the null they never resolve. (Same-player fleets
// would also bounce in the resolver, but cross-player ones never reach it.)
function nullifyInboundFleetTargetsForPlanetAbandon(planetId: number): void
{
    type PlanetCoordRow = { zone: number; galaxy: number; system: number; slot: number };
    const planetRow: PlanetCoordRow | undefined = DB.databaseConnection.prepare(
        "SELECT zone, galaxy, system, slot FROM planet WHERE id = ?"
    ).get(planetId) as PlanetCoordRow | undefined;

    if (planetRow === undefined || planetRow.zone !== GameType.PlanetZone.Planet)
    {
        return;
    }

    DB.databaseConnection.prepare(
        "UPDATE fleet_movement SET player_target_id = NULL WHERE is_return_trip = 0 AND planet_target_galaxy = ? AND planet_target_system = ? AND planet_target_slot = ?"
    ).run(planetRow.galaxy, planetRow.system, planetRow.slot);
}

export function deleteZone(zoneId: number): void
{
    type ZoneCoordRow = { id: number; galaxy: number; system: number; slot: number };
    const zoneRow: ZoneCoordRow | undefined = DB.databaseConnection.prepare(
        "SELECT id, galaxy, system, slot FROM planet WHERE id = ?"
    ).get(zoneId) as ZoneCoordRow | undefined;

    if (zoneRow === undefined)
    {
        return;
    }

    const associatedPlanet: { id: number } | undefined = DB.databaseConnection.prepare(
        "SELECT id FROM planet WHERE galaxy = ? AND system = ? AND slot = ? AND zone = ? AND id != ?"
    ).get(zoneRow.galaxy, zoneRow.system, zoneRow.slot, GameType.PlanetZone.Planet, zoneId) as { id: number } | undefined;

    if (associatedPlanet !== undefined)
    {
        DB.databaseConnection.prepare(
            "UPDATE fleet_movement SET planet_origin_id = ?, planet_origin_zone = ? WHERE planet_origin_id = ?"
        ).run(associatedPlanet.id, GameType.PlanetZone.Planet, zoneId);
    }
    else
    {
        DB.databaseConnection.prepare(
            "DELETE FROM fleet_movement WHERE planet_origin_id = ?"
        ).run(zoneId);
    }

    DB.databaseConnection.prepare(
        "DELETE FROM planet WHERE id = ?"
    ).run(zoneId);
}

function getZoneIdsToAbandon(planetId: number): number[]
{
    type TargetRow = { id: number; zone: number; galaxy: number; system: number; slot: number };
    const targetRow: TargetRow | undefined = DB.databaseConnection.prepare(
        "SELECT id, zone, galaxy, system, slot FROM planet WHERE id = ?"
    ).get(planetId) as TargetRow | undefined;

    if (targetRow === undefined)
    {
        return [];
    }

    if (targetRow.zone !== GameType.PlanetZone.Planet)
    {
        return [targetRow.id];
    }

    const coordinateRows: { id: number }[] = DB.databaseConnection.prepare(
        "SELECT id FROM planet WHERE galaxy = ? AND system = ? AND slot = ?"
    ).all(targetRow.galaxy, targetRow.system, targetRow.slot) as { id: number }[];

    return coordinateRows.map((row: { id: number }): number => row.id);
}