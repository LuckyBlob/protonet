"use client";

import { ReactElement } from "react";

import * as UseClientDataState from "@/lib/use/useClientDataState";
import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as DBType from "@/lib/db/dbTypes";
import * as HelperElements from "@/components/helpers/helperElements";

type StatsViewProps =
{
	clientDataStateResult: UseClientDataState.ClientDataStateResult;
};

const TOP_PLAYER_COUNT: number = 10;

//#region pure helpers
function buildRankedPlayerRows(publicPlayerRows: DBType.PublicPlayerRow[]): DBType.PublicPlayerRow[]
{
	const rankedPlayerRows: DBType.PublicPlayerRow[] = [...publicPlayerRows];
	rankedPlayerRows.sort((firstRow: DBType.PublicPlayerRow, secondRow: DBType.PublicPlayerRow): number =>
	{
		if (secondRow.score !== firstRow.score)
		{
			return secondRow.score - firstRow.score;
		}

		return firstRow.username.localeCompare(secondRow.username);
	});

	return rankedPlayerRows;
}

function findPlayerRank(rankedPlayerRows: DBType.PublicPlayerRow[], playerId: number): number
{
	const index: number = rankedPlayerRows.findIndex((row: DBType.PublicPlayerRow): boolean => row.id === playerId);
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

function renderPlayerRow(rank: number, publicPlayerRow: DBType.PublicPlayerRow, isSelf: boolean): ReactElement
{
	const rowClassName: string = isSelf === true
		? "flex justify-between px-3 py-1 rounded border border-blue-400 bg-blue-600 text-white font-semibold"
		: "flex justify-between px-3 py-1 rounded border border-gray-500";

	const rowElement: ReactElement =
	(
		<div key={publicPlayerRow.id} className={rowClassName}>
			<span className="w-8 text-right">{rank}</span>
			<span className="flex-1 px-3 truncate">{publicPlayerRow.username}</span>
			<span className="w-24 text-right">{publicPlayerRow.score.toLocaleString()}</span>
		</div>
	);

	return rowElement;
}

function renderOutsideTopSelfRows(selfPlayerRank: number, selfPublicPlayerRow: DBType.PublicPlayerRow): ReactElement
{
	const outsideTopSelfElement: ReactElement =
	(
		<div className="flex flex-col gap-1">
			<div className="text-center text-gray-400">…</div>
			{renderPlayerRow(selfPlayerRank, selfPublicPlayerRow, true)}
		</div>
	);

	return outsideTopSelfElement;
}

function renderStatsViewBody(rankedPlayerRows: DBType.PublicPlayerRow[], selfPlayerId: number): ReactElement
{
	const topPlayerRows: DBType.PublicPlayerRow[] = rankedPlayerRows.slice(0, TOP_PLAYER_COUNT);
	const selfPlayerRank: number = findPlayerRank(rankedPlayerRows, selfPlayerId);
	const isSelfOutsideTopPlayers: boolean = selfPlayerRank > TOP_PLAYER_COUNT;

	const topRowElements: ReactElement[] = topPlayerRows.map((publicPlayerRow: DBType.PublicPlayerRow, index: number): ReactElement =>
	{
		return renderPlayerRow(index + 1, publicPlayerRow, publicPlayerRow.id === selfPlayerId);
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
		const rankedPlayerRows: DBType.PublicPlayerRow[] = buildRankedPlayerRows(playerData.publicPlayerRows);
		const selfPlayerId: number = playerData.playerRow.id;

		return renderStatsViewBody(rankedPlayerRows, selfPlayerId);
	}
	catch (error: unknown)
	{
		console.error("⚠️:", error);
		return <HelperElements.EmptyElement />;
	}
}
