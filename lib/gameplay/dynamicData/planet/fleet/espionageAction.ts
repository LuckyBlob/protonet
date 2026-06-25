import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as StaticDataHelper from "@/lib/gameplay/coreData/static/staticDataHelpers";
import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as FleetData from "@/lib/gameplay/dynamicData/planet/fleet/fleetData";
import * as ResearchData from "@/lib/gameplay/dynamicData/player/researchData";
import * as Espionage from "@/lib/gameplay/coreData/formula/espionageFormulas";
import * as ThingHelpers from "@/lib/gameplay/coreData/thing/thingHelpers";
import * as ThingDataHelpers from "@/lib/gameplay/coreData/thing/thingDataHelpers";
import * as MessageData from "@/lib/gameplay/dynamicData/player/messageData";
import * as ThingType from "@/lib/gameplay/coreData/thing/thingTypes";
import * as MathHelp from "@/lib/helper/mathHelp";
import * as DBType from "@/lib/db/dbTypes";

export function resolveEspionageAction(originPlayerData: CoreType.PlayerData | null, targetPlayerData: CoreType.PlayerData | null, fleetMovement: CoreType.FleetMovement, serverData: CoreType.ServerData): void
{
    const originPlanetData: CoreType.PlanetData | null = originPlayerData !== null ? CoreType.getPlanetDataForId(originPlayerData.planetDatas, fleetMovement.fleetMovementRow.planet_origin_id) : null;
    const targetPlanetData: CoreType.PlanetData | null = targetPlayerData !== null ? CoreType.getPlanetDataForAddress(targetPlayerData.planetDatas, CoreType.getFleetTargetAddress(fleetMovement.fleetMovementRow)) : null;

    if (targetPlayerData === null || targetPlanetData === null)
    {
        FleetData.bounceFleetForMissingTarget(originPlayerData, fleetMovement);
        return;
    }

    const probeCount: number = countEspionageProbes(fleetMovement);
    const attackerEspionageTech: number = originPlayerData !== null ? ResearchData.getResearchLevel(originPlayerData, GameType.ResearchType.EspionageTech) : 0;
    const defenderEspionageTech: number = ResearchData.getResearchLevel(targetPlayerData, GameType.ResearchType.EspionageTech);

    const reportLevel: number = Espionage.computeEspionageReportLevel(probeCount, attackerEspionageTech, defenderEspionageTech);
    const revealedInfoBlocks: Set<Espionage.EspionageInfoBlock> = Espionage.getRevealedInfoBlocks(reportLevel);

    const defenderFleetSize: number = MathHelp.calculateTotalQuantityMap(targetPlanetData.dynamicPlanetData.shipQuantity);
    const detectionChance: number = Espionage.computeCounterEspionageDetectionChance(probeCount, attackerEspionageTech, defenderEspionageTech, defenderFleetSize);
    const probesDetected: boolean = Espionage.rollCounterEspionageDetection(fleetMovement.fleetMovementRow.seed, detectionChance);

    addEspionageReportMessage(originPlayerData, targetPlayerData, targetPlanetData, fleetMovement, revealedInfoBlocks);

    // Detected probes are shot down (they do not return home, so their ships are simply lost), and the
    // defender learns who spied them. Either way the report has already reached the attacker.
    if (probesDetected === true)
    {
        addCounterEspionageMessage(targetPlayerData, fleetMovement);

        FleetData.removeFleetMovement(targetPlanetData, fleetMovement.fleetMovementRow.id);
        if (originPlanetData !== null)
        {
            FleetData.removeFleetMovement(originPlanetData, fleetMovement.fleetMovementRow.id);
        }
        fleetMovement.resolutionState = CoreType.FleetMovementResolution.Resolved;
        return;
    }

    FleetData.setFleetReturnTrip(targetPlanetData, fleetMovement);
    fleetMovement.resolutionState = CoreType.FleetMovementResolution.Resolved;
}

function countEspionageProbes(fleetMovement: CoreType.FleetMovement): number
{
    const shipQuantities: Map<GameType.ShipType, number> = FleetData.buildShipQuantitiesFromRows(fleetMovement.fleetMovementShipRows);
    return shipQuantities.get(GameType.ShipType.EspionageProbe) ?? 0;
}

function buildEspionageReportBody(targetPlayerData: CoreType.PlayerData, targetPlanetData: CoreType.PlanetData, revealedInfoBlocks: Set<Espionage.EspionageInfoBlock>): string
{
    const reportLines: string[] = [];

    reportLines.push(`Resources: ${buildBlockOrRedacted(revealedInfoBlocks, Espionage.EspionageInfoBlock.Resources, (): string => buildQuantityList(targetPlanetData.dynamicPlanetData.resourceQuantity, (resourceType: GameType.ResourceType): ThingType.SpecificThingType => ThingHelpers.resource(resourceType)))}`);
    reportLines.push(`Fleet: ${buildBlockOrRedacted(revealedInfoBlocks, Espionage.EspionageInfoBlock.Fleet, (): string => buildQuantityList(targetPlanetData.dynamicPlanetData.shipQuantity, (shipType: GameType.ShipType): ThingType.SpecificThingType => ThingHelpers.ship(shipType)))}`);
    reportLines.push(`Buildings: ${buildBlockOrRedacted(revealedInfoBlocks, Espionage.EspionageInfoBlock.Buildings, (): string => buildLevelList(targetPlanetData.dynamicPlanetData.buildingLevels, (buildingType: GameType.BuildingType): ThingType.SpecificThingType => ThingHelpers.building(buildingType)))}`);
    reportLines.push(`Research: ${buildBlockOrRedacted(revealedInfoBlocks, Espionage.EspionageInfoBlock.Research, (): string => buildLevelList(ResearchData.getResearchLevelMap(targetPlayerData), (researchType: GameType.ResearchType): ThingType.SpecificThingType => ThingHelpers.research(researchType)))}`);

    return reportLines.join("\n");
}

function buildBlockOrRedacted(revealedInfoBlocks: Set<Espionage.EspionageInfoBlock>, infoBlock: Espionage.EspionageInfoBlock, buildContent: () => string): string
{
    if (revealedInfoBlocks.has(infoBlock) === false)
    {
        return "[insufficient probes to determine]";
    }

    return buildContent();
}

// Quantity-style blocks (resources, fleet) list "<amount> <name>", skipping anything the planet has none of.
function buildQuantityList<K extends number>(quantities: Map<K, number>, toSpecificThing: (specificThing: K) => ThingType.SpecificThingType): string
{
    const parts: string[] = [];
    for (const [specificThing, quantity] of quantities)
    {
        if (quantity <= 0)
        {
            continue;
        }

        const name: string = ThingDataHelpers.getSpecificThingName(toSpecificThing(specificThing));
        parts.push(`${quantity} ${name}`);
    }

    if (parts.length === 0)
    {
        return "none";
    }

    return parts.join(", ");
}

// Level-style blocks (buildings, research) list "<name> <level>", skipping anything at level 0.
function buildLevelList<K extends number>(levels: Map<K, number>, toSpecificThing: (specificThing: K) => ThingType.SpecificThingType): string
{
    const parts: string[] = [];
    for (const [specificThing, level] of levels)
    {
        if (level <= 0)
        {
            continue;
        }

        const name: string = ThingDataHelpers.getSpecificThingName(toSpecificThing(specificThing));
        parts.push(`${name} ${level}`);
    }

    if (parts.length === 0)
    {
        return "none";
    }

    return parts.join(", ");
}

function addEspionageReportMessage(originPlayerData: CoreType.PlayerData | null, targetPlayerData: CoreType.PlayerData, targetPlanetData: CoreType.PlanetData, fleetMovement: CoreType.FleetMovement, revealedInfoBlocks: Set<Espionage.EspionageInfoBlock>): void
{
    if (originPlayerData === null)
    {
        return;
    }

    const fleetRow: DBType.FleetMovementRow = fleetMovement.fleetMovementRow;
    const targetPlayerName: string = StaticDataHelper.getPlayerName(originPlayerData.publicPlayerRows, fleetRow.player_target_id);
    const targetAddress: string = StaticDataHelper.formatPlanetAddress(fleetRow.planet_target_galaxy, fleetRow.planet_target_system, fleetRow.planet_target_slot, fleetRow.planet_target_zone as GameType.PlanetZone);
    const receivedAt: number = fleetRow.started_at! + fleetRow.duration_at_start_time!;
    const reportBody: string = buildEspionageReportBody(targetPlayerData, targetPlanetData, revealedInfoBlocks);

    fleetMovement.originMessageRow =
    {
        id: -1, // placeholder, will be set properly when message is created in DB
        player_id: fleetRow.player_origin_id,
        received_at: receivedAt,
        type: MessageData.MessageType.Espionage,
        is_read: 0,
        title: `Espionage Report on ${targetPlayerName} at ${targetAddress}`,
        body: `Espionage report on ${targetPlayerName}'s ${targetAddress}.\n${reportBody}`,
    };
}

function addCounterEspionageMessage(targetPlayerData: CoreType.PlayerData, fleetMovement: CoreType.FleetMovement): void
{
    const fleetRow: DBType.FleetMovementRow = fleetMovement.fleetMovementRow;
    if (fleetRow.player_target_id === null)
    {
        return;
    }

    const originPlayerName: string = StaticDataHelper.getPlayerName(targetPlayerData.publicPlayerRows, fleetRow.player_origin_id);
    const targetAddress: string = StaticDataHelper.formatPlanetAddress(fleetRow.planet_target_galaxy, fleetRow.planet_target_system, fleetRow.planet_target_slot, fleetRow.planet_target_zone as GameType.PlanetZone);
    const originAddress: string = StaticDataHelper.formatPlanetAddress(fleetRow.planet_origin_galaxy, fleetRow.planet_origin_system, fleetRow.planet_origin_slot, fleetRow.planet_origin_zone as GameType.PlanetZone);
    const receivedAt: number = fleetRow.started_at! + fleetRow.duration_at_start_time!;

    fleetMovement.targetMessageRow =
    {
        id: -1, // placeholder, will be set properly when message is created in DB
        player_id: fleetRow.player_target_id,
        received_at: receivedAt,
        type: MessageData.MessageType.Espionage,
        is_read: 0,
        title: `Counterespionage at ${targetAddress}`,
        body: `${originPlayerName} from ${originAddress} spied your planet ${targetAddress}. Your defenses detected and destroyed the incoming espionage probes.`,
    };
}
