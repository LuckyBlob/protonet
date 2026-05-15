"use client";

import * as UseLoadClientDataState from "@/lib/use/useLoadClientDataState";

type StatsViewProps =
{
	clientDataStateResult: UseLoadClientDataState.ClientDataStateResult;
};

export function StatsView(props: StatsViewProps): React.ReactElement
{
	const statsViewElement: React.ReactElement =
	(
		<div>You're the top player!</div>
	);

	return statsViewElement;
}