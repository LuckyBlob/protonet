import * as TimeFormat from "@/lib/helper/timeFormat";
import * as UseClientDataState from "@/lib/use/useClientDataState";
import * as ResourceData from "@/lib/playerData/thingData/resourceData";
import * as SelectedPlanetDisplay from "@/lib/display/selectedPlanetDisplay";
import * as AssociationMaps from "@/lib/gameplay/coreData/associationMaps";
import * as HelperElements from "@/components/helperElements";

type TopBarProps =
{
	clientDataStateResult: UseClientDataState.ClientDataStateResult;
	planetSelector: React.ReactElement;
};

function renderResourceCard(resourceDisplayValues: SelectedPlanetDisplay.SelectedPlanetResourceDisplayValues, remainingMs: number): React.ReactElement
{
	const resourceName: string = AssociationMaps.RESOURCE_DISPLAY_NAMES.get(resourceDisplayValues.resourceType) ?? `Resource ${resourceDisplayValues.resourceType}`;

	const buildLineElement: React.ReactElement | null = resourceDisplayValues.affectedByCurrentBuild === true
		? <div className="text-sm">({TimeFormat.formatRemainingTimeMs(remainingMs)})</div>
		: null;

	const cardElement: React.ReactElement =
	(
		<div key={resourceDisplayValues.resourceType} className="flex flex-col items-center gap-1 border border-gray-400 rounded px-6 py-2">
			<div className="font-bold">{resourceName} {":"} {Math.floor(resourceDisplayValues.resource)}</div>
			<div>{Math.floor(resourceDisplayValues.productionRatePerHour)}/h</div>
			{buildLineElement}
		</div>
	);

	return cardElement;
}

export function TopBarElement(props: TopBarProps): React.ReactElement
{
	const resourceTypes: number[] = AssociationMaps.getTypes(AssociationMaps.ThingType.Resource);

	try
	{
		const displayValues: SelectedPlanetDisplay.SelectedPlanetDisplayValues = SelectedPlanetDisplay.getSelectedPlanetDisplayValues(props.clientDataStateResult, resourceTypes);

		const remainingMs: number = displayValues.buildCompletesAt - Date.now();

		const cardElements: React.ReactElement[] = displayValues.resourceDisplayValues.map((resourceDisplayValues: SelectedPlanetDisplay.SelectedPlanetResourceDisplayValues): React.ReactElement =>
		{
			return renderResourceCard(resourceDisplayValues, remainingMs);
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
	catch (error: unknown)
	{
		console.warn("⚠️:", error); 
		return <HelperElements.EmptyElement></HelperElements.EmptyElement>;
	}
}