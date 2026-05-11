"use client";

import * as MainPageTypes from "@/lib/mainPageTypes";

type StatsViewProps =
{
	psController: MainPageTypes.PSController;
};

export function StatsView(props: StatsViewProps): React.ReactElement
{
	const statsViewElement: React.ReactElement =
	(
		<div>Stats view (TODO)</div>
	);

	return statsViewElement;
}