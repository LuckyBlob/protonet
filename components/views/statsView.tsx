"use client";

import { ReactElement } from "react";

import * as UseClientDataState from "@/lib/use/useClientDataState";
import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as HelperElements from "@/components/helpers/helperElements";

type StatsViewProps =
{
	clientDataStateResult: UseClientDataState.ClientDataStateResult;
};

const TOP_PLAYER_COUNT: number = 10;

//#region pure helpers
function buildRankedPlayerRows(publicPlayerDatas: CoreType.PublicPlayerData[]): CoreType.PublicPlayerData[]
{
	const rankedPlayerRows: CoreType.PublicPlayerData[] = [...publicPlayerDatas];
	rankedPlayerRows.sort((firstRow: CoreType.PublicPlayerData, secondRow: CoreType.PublicPlayerData): number =>
	{
		if (secondRow.score !== firstRow.score)
		{
			return secondRow.score - firstRow.score;
		}

		return firstRow.username.localeCompare(secondRow.username);
	});

	return rankedPlayerRows;
}

function findPlayerRank(rankedPlayerRows: CoreType.PublicPlayerData[], playerId: number): number
{
	const index: number = rankedPlayerRows.findIndex((row: CoreType.PublicPlayerData): boolean => row.id === playerId);
	if (index === -1)
	{
		return -1;
	}

	return index + 1;
}
//#endregion

//#region rendering helpers
function renderLeaderboardHeader(): ReactElement
{
	const headerElement: ReactElement =
	(
		<div className="flex justify-between px-3 py-1 text-xs uppercase tracking-wide text-gray-400">
			<span className="w-8 text-right">#</span>
			<span className="flex-1 px-3">Player</span>
			<span className="w-24 text-right">Score</span>
		</div>
	);

	return headerElement;
}

function renderPlayerRow(rank: number, publicPlayerData: CoreType.PublicPlayerData, isSelf: boolean): ReactElement
{
	const rowClassName: string = isSelf === true
		? "flex justify-between px-3 py-1 rounded border border-blue-400 bg-blue-600 text-white font-semibold"
		: "flex justify-between px-3 py-1 rounded border border-gray-500";

	const rowElement: ReactElement =
	(
		<div key={publicPlayerData.id} className={rowClassName}>
			<span className="w-8 text-right">{rank}</span>
			<span className="flex-1 px-3 truncate">{publicPlayerData.username}</span>
			<span className="w-24 text-right">{publicPlayerData.score.toLocaleString()}</span>
		</div>
	);

	return rowElement;
}

function renderOutsideTopSelfRows(selfPlayerRank: number, selfPublicPlayerData: CoreType.PublicPlayerData): ReactElement
{
	const outsideTopSelfElement: ReactElement =
	(
		<div className="flex flex-col gap-1">
			<div className="text-center text-gray-400">…</div>
			{renderPlayerRow(selfPlayerRank, selfPublicPlayerData, true)}
		</div>
	);

	return outsideTopSelfElement;
}

function renderStatsViewBody(rankedPlayerRows: CoreType.PublicPlayerData[], selfPlayerId: number): ReactElement
{
	const topPlayerRows: CoreType.PublicPlayerData[] = rankedPlayerRows.slice(0, TOP_PLAYER_COUNT);
	const selfPlayerRank: number = findPlayerRank(rankedPlayerRows, selfPlayerId);
	const isSelfOutsideTopPlayers: boolean = selfPlayerRank > TOP_PLAYER_COUNT;

	const topRowElements: ReactElement[] = topPlayerRows.map((publicPlayerData: CoreType.PublicPlayerData, index: number): ReactElement =>
	{
		return renderPlayerRow(index + 1, publicPlayerData, publicPlayerData.id === selfPlayerId);
	});

	const statsViewElement: ReactElement =
	(
		<div className="flex flex-col items-center gap-4">
			<div className="text-lg font-semibold">Top Players</div>
			<div className="flex flex-col gap-1 w-96">
				{renderLeaderboardHeader()}
				{topRowElements}
				{isSelfOutsideTopPlayers === true
					? renderOutsideTopSelfRows(selfPlayerRank, rankedPlayerRows[selfPlayerRank - 1])
					: null}
			</div>
		</div>
	);

	return statsViewElement;
}
//#endregion

export function StatsView(props: StatsViewProps): ReactElement
{
	try
	{
		const playerData: CoreType.PlayerData = props.clientDataStateResult.psController[0].predictedDBData;
		const rankedPlayerRows: CoreType.PublicPlayerData[] = buildRankedPlayerRows(playerData.publicPlayerDatas);
		const selfPlayerId: number = playerData.playerRow.id;

		return renderStatsViewBody(rankedPlayerRows, selfPlayerId);
	}
	catch (error: unknown)
	{
		console.error("⚠️:", error);
		return <HelperElements.EmptyElement />;
	}
}
