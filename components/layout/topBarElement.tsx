import { ReactElement } from "react";

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
import * as CalculatedValueData from "@/lib/gameplay/dynamicData/calculatedValueData";
import * as StaticData from "@/lib/gameplay/coreData/static/staticData";

type TopBarProps =
{
	clientDataStateResult: UseClientDataState.ClientDataStateResult;
	planetSelector: ReactElement;
};

function formatSourceContributionLine(sourceContribution: CalculatedValueData.ValueSourceContribution): string
{
	const sourceName: string = ThingDataHelpers.getSpecificThingName(sourceContribution.source);
	const sign: string = sourceContribution.ratePerHour < 0 ? "-" : "";
	const magnitude: number = Math.floor(Math.abs(sourceContribution.ratePerHour));

	return `${sourceName}: ${sign}${magnitude}/h`;
}

function formatBonusContributionLine(bonusContribution: CalculatedValueData.ValueBonusContribution): string
{
	const percentSign: string = bonusContribution.percent < 0 ? "-" : "+";
	const percentMagnitude: number = Math.round(Math.abs(bonusContribution.percent));

	const deltaSign: string = bonusContribution.ratePerHourDelta < 0 ? "-" : "+";
	const deltaMagnitude: number = Math.floor(Math.abs(bonusContribution.ratePerHourDelta));

	return `${bonusContribution.label}: ${percentSign}${percentMagnitude}% (${deltaSign}${deltaMagnitude}/h)`;
}

function appendBreakdownContributionLines(tooltipLines: string[], breakdown: CalculatedValueData.CalculatedValueBreakdown): void
{
	for (const sourceContribution of breakdown.sourceContributions)
	{
		tooltipLines.push(formatSourceContributionLine(sourceContribution));
	}

	for (const bonusContribution of breakdown.bonusContributions)
	{
		tooltipLines.push(formatBonusContributionLine(bonusContribution));
	}
}

function buildResourceTooltipLines(breakdown: CalculatedValueData.CalculatedValueBreakdown): string[]
{
	const tooltipLines: string[] = [];

	tooltipLines.push(`Total production per hour: ${Math.floor(breakdown.totalRatePerHour)}/h`);
	appendBreakdownContributionLines(tooltipLines, breakdown);

	return tooltipLines;
}

function buildPlanetValueTooltipLines(breakdown: CalculatedValueData.CalculatedValueBreakdown): string[]
{
	const tooltipLines: string[] = [];

	appendBreakdownContributionLines(tooltipLines, breakdown);

	return tooltipLines;
}

function renderResourceCard(resourceDisplayValues: PlanetResourceDisplayValues): ReactElement
{
	const resourceName: string = ThingDataHelpers.getSpecificThingName(ThingHelpers.resource(resourceDisplayValues.resourceType));

	const isAtOrOverMaximum: boolean = resourceDisplayValues.resource >= resourceDisplayValues.resourceMaximum;
	const quantityColorClass: string = isAtOrOverMaximum ? "text-red-500" : "text-white";

	const cardElement: ReactElement =
	(
		<div className="flex flex-col items-center gap-1 border border-gray-400 rounded px-6 py-2">
			<div className="font-bold">{resourceName}</div>
			<div className={quantityColorClass}>{Math.floor(resourceDisplayValues.resource)} / {Math.floor(resourceDisplayValues.resourceMaximum)}</div>
		</div>
	);

	return HelperElements.renderWithTooltip(resourceDisplayValues.tooltipLines, cardElement, "below");
}

function renderPlanetValueCard(planetValueDisplayValues: PlanetValueCardDisplayValues): ReactElement
{
	const planetValueName: string = ThingDataHelpers.getSpecificThingName(ThingHelpers.planetValue(planetValueDisplayValues.planetValueType));
	const productionValue: number = Math.floor(planetValueDisplayValues.production);
	const consumptionValue: number = Math.floor(planetValueDisplayValues.consumption);

	const isProductionCoveringConsumption: boolean = planetValueDisplayValues.production >= planetValueDisplayValues.consumption;
	const valueColorClass: string = isProductionCoveringConsumption ? "text-white" : "text-red-500";

	const cardElement: ReactElement =
	(
		<div className="flex flex-col items-center gap-1 border border-gray-400 rounded px-6 py-2">
			<div className="font-bold">{planetValueName}</div>
			<div className={valueColorClass}>{consumptionValue} / {productionValue}</div>
		</div>
	);

	return HelperElements.renderWithTooltip(planetValueDisplayValues.tooltipLines, cardElement, "below");
}

export function TopBarElement(props: TopBarProps): ReactElement
{
	const resourceTypes: GameType.ResourceType[] = StaticDataHelper.getAllSpecificThings(ThingType.Thing.Resource);

	try
	{
		const displayValues: PlanetDisplayValues = getPlanetDisplayValues(props.clientDataStateResult, resourceTypes);

		const resourceCardElements: ReactElement[] = displayValues.resourceDisplayValues.map((resourceDisplayValues: PlanetResourceDisplayValues): ReactElement =>
		{
			const resourceCardElement: ReactElement =
			(
				<div key={resourceDisplayValues.resourceType}>
					{renderResourceCard(resourceDisplayValues)}
				</div>
			);

			return resourceCardElement;
		});

		// Newest planet value type sits closest to the centre, so the cluster grows leftward from the right edge.
		const orderedPlanetValueDisplayValues: PlanetValueCardDisplayValues[] = [...displayValues.planetValueDisplayValues].reverse();
		const planetValueCardElements: ReactElement[] = orderedPlanetValueDisplayValues.map((planetValueDisplayValues: PlanetValueCardDisplayValues): ReactElement =>
		{
			const planetValueCardElement: ReactElement =
			(
				<div key={planetValueDisplayValues.planetValueType}>
					{renderPlanetValueCard(planetValueDisplayValues)}
				</div>
			);

			return planetValueCardElement;
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
		return <HelperElements.EmptyElement />;
	}
}

export type PlanetResourceDisplayValues =
{
	resourceType: GameType.ResourceType;
	resource: number;
	resourceMaximum: number;
	tooltipLines: string[];
};

export type PlanetValueCardDisplayValues =
{
	planetValueType: GameType.PlanetValueType;
	production: number;
	consumption: number;
	tooltipLines: string[];
};

export type PlanetDisplayValues =
{
	resourceDisplayValues: PlanetResourceDisplayValues[];
	planetValueDisplayValues: PlanetValueCardDisplayValues[];
};

export function getPlanetDisplayValues(clientDataStateResult: UseClientDataState.ClientDataStateResult, resourceTypes: GameType.ResourceType[]): PlanetDisplayValues
{
	const planetDataPredicted: CoreType.PlanetData = SelectedPlanet.getSelectedPlanetDataPredicted(clientDataStateResult.psController[0]);
	const playerData: CoreType.PlayerData = clientDataStateResult.psController[0].predictedDBData;
	const serverData: CoreType.ServerData = clientDataStateResult.sdsController[0];

	const resourceMaximums: Map<GameType.ResourceType, number> = CalculatedValueData.computeResourceMaximums(planetDataPredicted, playerData);

	const resourceDisplayValues: PlanetResourceDisplayValues[] = [];

	for (const resourceType of resourceTypes)
	{
		const calculatedNewResourceQuantity: number = ResourceData.getResourceQuantity(planetDataPredicted, resourceType);
		const resourceMaximum: number = resourceMaximums.get(resourceType) ?? 0;

		const productionBreakdown: CalculatedValueData.CalculatedValueBreakdown = BuildingData.computeResourceProductionBreakdown(planetDataPredicted, resourceType, serverData, playerData);
		const tooltipLines: string[] = buildResourceTooltipLines(productionBreakdown);

		const singleResourceDisplayValues: PlanetResourceDisplayValues =
		{
			resourceType: resourceType,
			resource: calculatedNewResourceQuantity,
			resourceMaximum: resourceMaximum,
			tooltipLines: tooltipLines,
		};

		resourceDisplayValues.push(singleResourceDisplayValues);
	}

	const planetValueDisplayValues: PlanetValueCardDisplayValues[] = getPlanetValueCardDisplayValues(planetDataPredicted, playerData);

	const displayValues: PlanetDisplayValues =
	{
		resourceDisplayValues: resourceDisplayValues,
		planetValueDisplayValues: planetValueDisplayValues,
	};

	return displayValues;
}

function getPlanetValueCardDisplayValues(planetDataPredicted: CoreType.PlanetData, playerData: CoreType.PlayerData): PlanetValueCardDisplayValues[]
{
	const planetValueAmountsMap: Map<GameType.PlanetValueType, CoreType.CalculatedValueData> = CalculatedValueData.computePlanetValueDatas(planetDataPredicted, playerData);

	const planetValueDisplayValues: PlanetValueCardDisplayValues[] = [];

	for (const [planetValueType, planetValueInfo] of StaticData.PLANET_VALUE_INFOS)
	{
		if (planetValueInfo.showInTopBar === false)
		{
			continue;
		}

		const planetValueAmounts: CoreType.CalculatedValueData | undefined = planetValueAmountsMap.get(planetValueType);

		const planetValueBreakdown: CalculatedValueData.CalculatedValueBreakdown = CalculatedValueData.computePlanetValueBreakdown(planetDataPredicted, planetValueType, playerData);
		const tooltipLines: string[] = buildPlanetValueTooltipLines(planetValueBreakdown);

		const singlePlanetValueDisplayValues: PlanetValueCardDisplayValues =
		{
			planetValueType: planetValueType,
			production: planetValueAmounts?.production ?? 0,
			consumption: planetValueAmounts?.consumption ?? 0,
			tooltipLines: tooltipLines,
		};

		planetValueDisplayValues.push(singlePlanetValueDisplayValues);
	}

	return planetValueDisplayValues;
}
