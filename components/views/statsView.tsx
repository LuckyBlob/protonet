"use client";

import { ReactElement } from "react";

import * as UseClientDataState from "@/lib/use/useClientDataState";

type StatsViewProps =
{
	clientDataStateResult: UseClientDataState.ClientDataStateResult;
};

export function StatsView(props: StatsViewProps): ReactElement
{
	const statsViewElement: ReactElement =
	(
		<div>You're the top player!</div>
	);

	return statsViewElement;
}