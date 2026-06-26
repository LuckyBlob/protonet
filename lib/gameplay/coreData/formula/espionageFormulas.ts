import * as MathHelp from "@/lib/helper/mathHelp";

export const EspionageInfoBlock =
{
    Resources: 1,
    Fleet: 2,
    Buildings: 3,
    Research: 4,
} as const;
export type EspionageInfoBlock = typeof EspionageInfoBlock[keyof typeof EspionageInfoBlock];

export const ESPIONAGE_INFO_BLOCK_THRESHOLDS: ReadonlyMap<EspionageInfoBlock, number> = new Map<EspionageInfoBlock, number>
([
    [EspionageInfoBlock.Resources, 1],
    [EspionageInfoBlock.Fleet, 2],
    [EspionageInfoBlock.Buildings, 3],
    [EspionageInfoBlock.Research, 5],
]);

const COUNTER_ESPIONAGE_BASE_FACTOR: number = 0.0025; // 0.25% per probe per defending unit
const COUNTER_ESPIONAGE_TECH_BASE: number = 2;

export function computeEspionageReportLevel(probeCount: number, attackerEspionageTech: number, defenderEspionageTech: number): number
{
    const techDifference: number = attackerEspionageTech - defenderEspionageTech;
    const signedSquaredDifference: number = Math.sign(techDifference) * techDifference * techDifference;

    return probeCount + signedSquaredDifference;
}

export function getRevealedInfoBlocks(reportLevel: number): Set<EspionageInfoBlock>
{
    const revealedBlocks: Set<EspionageInfoBlock> = new Set<EspionageInfoBlock>();

    for (const [infoBlock, threshold] of ESPIONAGE_INFO_BLOCK_THRESHOLDS)
    {
        if (reportLevel >= threshold)
        {
            revealedBlocks.add(infoBlock);
        }
    }

    return revealedBlocks;
}

export function computeCounterEspionageDetectionChance(probeCount: number, attackerEspionageTech: number, defenderEspionageTech: number, defenderFleetSize: number): number
{
    const defenderTechAdvantage: number = defenderEspionageTech - attackerEspionageTech;
    const techMultiplier: number = Math.pow(COUNTER_ESPIONAGE_TECH_BASE, defenderTechAdvantage);
    const rawChance: number = techMultiplier * probeCount * defenderFleetSize * COUNTER_ESPIONAGE_BASE_FACTOR;

    return Math.min(Math.max(rawChance, 0), 1);
}

export function rollCounterEspionageDetection(seed: number, detectionChance: number): boolean
{
    return MathHelp.seededRandom(seed) < detectionChance;
}
