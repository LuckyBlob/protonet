import { ReactElement } from "react";

import * as TimeFormat from "@/lib/helper/timeFormat";
import * as UseClientDataState from "@/lib/use/useClientDataState";
import * as ThingType from "@/lib/gameplay/coreData/thing/thingTypes";
import * as ThingHelpers from "@/lib/gameplay/coreData/thing/thingHelpers";
import * as ThingDataHelpers from "@/lib/gameplay/coreData/thing/thingDataHelpers";
import * as StaticDataHelper from "@/lib/gameplay/coreData/static/staticDataHelpers";
import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";
import * as HelperElements from "@/components/helpers/helperElements";
import * as SelectedPlanet from "@/lib/localStorage/selectedPlanet";
import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as ResourceData from "@/lib/gameplay/dynamicData/planet/resourceData";
import * as BuildingData from "@/lib/gameplay/dynamicData/planet/buildingData";
import * as BuildingUpgradeData from "@/lib/gameplay/dynamicData/planet/buildingUpgradeData";
import * as CalculatedValueData from "@/lib/gameplay/dynamicData/calculatedValueData";
import * as StaticData from "@/lib/gameplay/coreData/static/staticData";

type TopBarProps =
{
	clientDataStateResult: UseClientDataState.ClientDataStateResult;
	planetSelector: ReactElement;
};

function renderResourceCard(resourceDisplayValues: PlanetResourceDisplayValues, remainingMs: number | null): ReactElement
{
	const resourceName: string = ThingDataHelpers.getSpecificThingName(ThingHelpers.resource(resourceDisplayValues.resourceType));

	const buildLineElement: ReactElement | null = (resourceDisplayValues.affectedByCurrentBuild === true && remainingMs !== null)
		? <div className="text-sm">({TimeFormat.formatRemainingTimeMs(remainingMs)})</div>
		: null;

	// Red once the resource sits at or above its storage maximum: production has stopped contributing.
	const isAtOrOverMaximum: boolean = resourceDisplayValues.resource >= resourceDisplayValues.resourceMaximum;
	const quantityColorClass: string = isAtOrOverMaximum ? "text-red-500" : "text-white";

	const cardElement: ReactElement =
	(
		<div key={resourceDisplayValues.resourceType} className="flex flex-col items-center gap-1 border border-gray-400 rounded px-6 py-2">
			<div className="font-bold">{resourceName} {":"} <span className={quantityColorClass}>{Math.floor(resourceDisplayValues.resource)} / {Math.floor(resourceDisplayValues.resourceMaximum)}</span></div>
			<div>{Math.floor(resourceDisplayValues.productionRatePerHour)}/h</div>
			{buildLineElement}
		</div>
	);

	return cardElement;
}

function renderPlanetValueCard(planetValueDisplayValues: PlanetValueCardDisplayValues): ReactElement
{
	const planetValueName: string = ThingDataHelpers.getSpecificThingName(ThingHelpers.planetValue(planetValueDisplayValues.planetValueType));
	const productionValue: number = Math.floor(planetValueDisplayValues.production);
	const consumptionValue: number = Math.floor(planetValueDisplayValues.consumption);

	// White once production covers consumption (ratio >= 1), red while consumption outpaces it.
	const isProductionCoveringConsumption: boolean = planetValueDisplayValues.production >= planetValueDisplayValues.consumption;
	const valueColorClass: string = isProductionCoveringConsumption ? "text-white" : "text-red-500";

	const cardElement: ReactElement =
	(
		<div key={planetValueDisplayValues.planetValueType} className="flex flex-col items-center gap-1 border border-gray-400 rounded px-6 py-2">
			<div className="font-bold">{planetValueName}{":"} <span className={valueColorClass}>{productionValue}/{consumptionValue}</span></div>
		</div>
	);

	return cardElement;
}

export function TopBarElement(props: TopBarProps): ReactElement
{
	const resourceTypes: GameType.ResourceType[] = StaticDataHelper.getAllSpecificThings(ThingType.Thing.Resource);

	try
	{
		const displayValues: PlanetDisplayValues = getPlanetDisplayValues(props.clientDataStateResult, resourceTypes);

		const resourceCardElements: ReactElement[] = displayValues.resourceDisplayValues.map((resourceDisplayValues: PlanetResourceDisplayValues): ReactElement =>
		{
			return renderResourceCard(resourceDisplayValues, displayValues.remainingBuildingUpgradeMs);
		});

		// Newest planet value type sits closest to the centre, so the cluster grows leftward from the right edge.
		const orderedPlanetValueDisplayValues: PlanetValueCardDisplayValues[] = [...displayValues.planetValueDisplayValues].reverse();
		const planetValueCardElements: ReactElement[] = orderedPlanetValueDisplayValues.map((planetValueDisplayValues: PlanetValueCardDisplayValues): ReactElement =>
		{
			return renderPlanetValueCard(planetValueDisplayValues);
		});

		const topBarElement: ReactElement =
		(
			<div className="relative bg-black/50 text-white py-3 px-4">
				<div className="absolute left-4 top-3">
					{props.planetSelector}
				</div>
				<div className="flex justify-center gap-4">
					{resourceCardElements}
				</div>
				<div className="absolute right-4 top-3 flex items-start gap-4">
					{planetValueCardElements}
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
	resourceType: GameType.ResourceType;
	resource: number;
	resourceMaximum: number;
	productionRatePerHour: number;
	affectedByCurrentBuild: boolean;
};

export type PlanetValueCardDisplayValues =
{
	planetValueType: GameType.PlanetValueType;
	production: number;
	consumption: number;
};

export type PlanetDisplayValues =
{
	resourceDisplayValues: PlanetResourceDisplayValues[];
	planetValueDisplayValues: PlanetValueCardDisplayValues[];
	remainingBuildingUpgradeMs: number | null;
};

export function getPlanetDisplayValues(clientDataStateResult: UseClientDataState.ClientDataStateResult, resourceTypes: GameType.ResourceType[]): PlanetDisplayValues
{
	const planetDataPredicted: CoreType.PlanetData = SelectedPlanet.getSelectedPlanetDataPredicted(clientDataStateResult.psController[0]);
	const buildingBeingUpgraded: GameType.BuildingType | null = BuildingUpgradeData.getBuildingTypeCurrentlyUpgrading(planetDataPredicted);

	const playerData: CoreType.PlayerData = clientDataStateResult.psController[0].predictedDBData;

	const resourceMaximums: Map<GameType.ResourceType, number> = CalculatedValueData.computeResourceMaximums(planetDataPredicted, playerData);

	const resourceDisplayValues: PlanetResourceDisplayValues[] = [];

	for (const resourceType of resourceTypes)
	{
		const calculatedNewResourceQuantity: number = ResourceData.getResourceQuantity(planetDataPredicted, resourceType);
		const resourceMaximum: number = resourceMaximums.get(resourceType) ?? 0;

		const productionRatePerSecond: number = BuildingData.getPlanetProductionRatePerSecond(planetDataPredicted, resourceType, clientDataStateResult.sdsController[0], playerData);

		// Once the resource is at or above its maximum, production no longer accumulates, so show 0/h.
		const isAtOrOverMaximum: boolean = calculatedNewResourceQuantity >= resourceMaximum;
		const productionRatePerHour: number = isAtOrOverMaximum ? 0 : productionRatePerSecond * 3600;

		const affectedByCurrentBuild: boolean = (buildingBeingUpgraded !== null) && (BuildingData.doesBuildingProduceResource(buildingBeingUpgraded, resourceType) === true);

		const singleResourceDisplayValues: PlanetResourceDisplayValues =
		{
			resourceType: resourceType,
			resource: calculatedNewResourceQuantity,
			resourceMaximum: resourceMaximum,
			productionRatePerHour: productionRatePerHour,
			affectedByCurrentBuild: affectedByCurrentBuild,
		};

		resourceDisplayValues.push(singleResourceDisplayValues);
	}

	const planetValueDisplayValues: PlanetValueCardDisplayValues[] = getPlanetValueCardDisplayValues(planetDataPredicted, playerData);

	const displayValues: PlanetDisplayValues =
	{
		resourceDisplayValues: resourceDisplayValues,
		planetValueDisplayValues: planetValueDisplayValues,
		remainingBuildingUpgradeMs: BuildingUpgradeData.getBuildingUpgradeRemainingMs(planetDataPredicted),
	};

	return displayValues;
}

function getPlanetValueCardDisplayValues(planetDataPredicted: CoreType.PlanetData, playerData: CoreType.PlayerData): PlanetValueCardDisplayValues[]
{
	const planetValueAmountsMap: Map<GameType.PlanetValueType, CoreType.CalculatedValueData> = CalculatedValueData.computePlanetValueDatas(planetDataPredicted, playerData);

	const planetValueDisplayValues: PlanetValueCardDisplayValues[] = [];

	// Only the planet values flagged for the top bar are shown; the rest are still tracked, just not here.
	for (const [planetValueType, planetValueInfo] of StaticData.PLANET_VALUE_INFOS)
	{
		if (planetValueInfo.showInTopBar === false)
		{
			continue;
		}

		const planetValueAmounts: CoreType.CalculatedValueData | undefined = planetValueAmountsMap.get(planetValueType);

		const singlePlanetValueDisplayValues: PlanetValueCardDisplayValues =
		{
			planetValueType: planetValueType,
			production: planetValueAmounts?.production ?? 0,
			consumption: planetValueAmounts?.consumption ?? 0,
		};

		planetValueDisplayValues.push(singlePlanetValueDisplayValues);
	}

	return planetValueDisplayValues;
}
