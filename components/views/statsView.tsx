"use client";

import * as UseClientDataState from "@/lib/use/useClientDataState";

type StatsViewProps =
{
	clientDataStateResult: UseClientDataState.ClientDataStateResult;
};

export function StatsView(props: StatsViewProps): React.ReactElement
{
	const statsViewElement: React.ReactElement =
	(
		<div>You're the top player!</div>
	);

	return statsViewElement;
}