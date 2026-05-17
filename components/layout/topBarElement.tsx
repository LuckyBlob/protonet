import * as TimeFormat from "@/lib/helper/timeFormat";

import * as UseClientDataState from "@/lib/use/useClientDataState";

import * as SelectedPlanetDisplay from "@/lib/display/selectedPlanetDisplay";
import * as AssociationMaps from "@/lib/gameplay/coreData/associationMaps";
import * as HelperElements from "@/components/helperElements";

type TopBarProps =
{
	clientDataStateResult: UseClientDataState.ClientDataStateResult;
	planetSelector: React.ReactElement;
};

function renderRessourceCard(ressourceDisplayValues: SelectedPlanetDisplay.SelectedPlanetRessourceDisplayValues, remainingMs: number): React.ReactElement
{
	const ressourceName: string = AssociationMaps.RESSOURCE_DISPLAY_NAMES.get(ressourceDisplayValues.ressourceType) ?? `Ressource ${ressourceDisplayValues.ressourceType}`;

	const buildLineElement: React.ReactElement | null = ressourceDisplayValues.affectedByCurrentBuild === true
		? <div className="text-sm">({TimeFormat.formatRemainingTimeMs(remainingMs)})</div>
		: null;

	const cardElement: React.ReactElement =
	(
		<div key={ressourceDisplayValues.ressourceType} className="flex flex-col items-center gap-1 border border-gray-400 rounded px-6 py-2">
			<div className="font-bold">{ressourceName} {":"} {Math.floor(ressourceDisplayValues.ressource)}</div>
			<div>{Math.floor(ressourceDisplayValues.productionRatePerHour)}/h</div>
			{buildLineElement}
		</div>
	);

	return cardElement;
}

export function TopBarElement(props: TopBarProps): React.ReactElement
{
	const ressourceTypes: number[] = [...AssociationMaps.RESSOURCE_DISPLAY_NAMES.keys()];

	const displayValues: SelectedPlanetDisplay.SelectedPlanetDisplayValues | null = SelectedPlanetDisplay.getSelectedPlanetDisplayValues(props.clientDataStateResult, ressourceTypes);

	if (displayValues === null)
	{
		return <HelperElements.EmptyElement></HelperElements.EmptyElement>;
	}

	const remainingMs: number = displayValues.buildCompletesAt - Date.now();

	const cardElements: React.ReactElement[] = displayValues.ressourceDisplayValues.map((ressourceDisplayValues: SelectedPlanetDisplay.SelectedPlanetRessourceDisplayValues): React.ReactElement =>
	{
		return renderRessourceCard(ressourceDisplayValues, remainingMs);
	});

	const topBarElement: React.ReactElement =
	(
		<div className="bg-black/50 text-white py-3 px-4 flex items-start">
			<div className="flex items-center">
				{props.planetSelector}
			</div>
			<div className="flex-1 flex justify-center gap-4">
				{cardElements}
			</div>
		</div>
	);

	return topBarElement;
}