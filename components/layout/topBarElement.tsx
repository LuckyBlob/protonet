import * as TimeFormat from "@/lib/helper/timeFormat";
import * as UseClientDataState from "@/lib/use/useClientDataState";
import * as ThingType from "@/lib/gameplay/coreData/type/thingTypes";
import * as HelperElements from "@/components/helperElements";
import * as SelectedPlanet from "@/lib/localStorage/selectedPlanet";
import * as PlayerDataType from "@/lib/gameplay/gameplayData/player/playerDataTypes";
import * as ResourceData from "@/lib/gameplay/gameplayData/dynamic/resourceData";
import * as BuildingData from "@/lib/gameplay/gameplayData/dynamic/buildingData";

type TopBarProps =
{
	clientDataStateResult: UseClientDataState.ClientDataStateResult;
	planetSelector: React.ReactElement;
};

function renderResourceCard(resourceDisplayValues: PlanetResourceDisplayValues, remainingMs: number): React.ReactElement
{
	const resourceName: string = ThingType.getSpecificThingName(ThingType.resource(resourceDisplayValues.resourceType));

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
	const resourceTypes: number[] = ThingType.getAllSpecificThings(ThingType.Thing.Resource);

	try
	{
		const displayValues: PlanetDisplayValues = getPlanetDisplayValues(props.clientDataStateResult, resourceTypes);

		const remainingMs: number = displayValues.buildCompletesAt - Date.now();

		const cardElements: React.ReactElement[] = displayValues.resourceDisplayValues.map((resourceDisplayValues: PlanetResourceDisplayValues): React.ReactElement =>
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
		console.error("⚠️:", error); 
		return <HelperElements.EmptyElement></HelperElements.EmptyElement>;
	}
}

export type PlanetResourceDisplayValues =
{
	resourceType: number;
	resource: number;
	productionRatePerHour: number;
	affectedByCurrentBuild: boolean;
};

export type PlanetDisplayValues =
{
	resourceDisplayValues: PlanetResourceDisplayValues[];
	buildCompletesAt: number;
};

export function getPlanetDisplayValues(clientDataStateResult: UseClientDataState.ClientDataStateResult, resourceTypes: number[]): PlanetDisplayValues
{
	const now: number = Date.now();

	const fullPlanetDataPredicted: PlayerDataType.FullPlanetData = SelectedPlanet.getSelectedFullPlanetDataPredicted(clientDataStateResult.psController[0]);
	const buildCompletesAt: number = fullPlanetDataPredicted.planetRow.building_upgrade_completes_at;
	const isBuilding: boolean = buildCompletesAt !== 0;
	const buildingBeingUpgraded: number = fullPlanetDataPredicted.planetRow.building_being_upgraded;

	const resourceDisplayValues: PlanetResourceDisplayValues[] = [];

	for (const resourceType of resourceTypes)
	{
		const calculatedNewResourceQuantity: number = ResourceData.getResourceQuantity(fullPlanetDataPredicted, resourceType);

		const productionRatePerSecond: number = BuildingData.getPlanetProductionRatePerSecond(fullPlanetDataPredicted, resourceType, clientDataStateResult.sdsController[0]);
		const productionRatePerHour: number = productionRatePerSecond * 3600;

		const affectedByCurrentBuild: boolean = (isBuilding === true) && (BuildingData.doesBuildingProduceResource(buildingBeingUpgraded, resourceType) === true);

		const singleResourceDisplayValues: PlanetResourceDisplayValues =
		{
			resourceType: resourceType,
			resource: calculatedNewResourceQuantity,
			productionRatePerHour: productionRatePerHour,
			affectedByCurrentBuild: affectedByCurrentBuild,
		};

		resourceDisplayValues.push(singleResourceDisplayValues);
	}

	const displayValues: PlanetDisplayValues =
	{
		resourceDisplayValues: resourceDisplayValues,
		buildCompletesAt: buildCompletesAt,
	};

	return displayValues;
}