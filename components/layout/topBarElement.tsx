import { useRouter } from "next/navigation";
import { ReactElement } from "react";

import * as TimeFormat from "@/lib/helper/timeFormat";
import * as UseClientDataState from "@/lib/use/useClientDataState";
import * as UseCurrentUser from "@/lib/use/useCurrentUser";
import * as ThingType from "@/lib/gameplay/coreData/type/thingTypes";
import * as HelperElements from "@/components/helperElements";
import * as SelectedPlanet from "@/lib/localStorage/selectedPlanet";
import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as ResourceData from "@/lib/gameplay/dynamicData/planet/resourceData";
import * as BuildingData from "@/lib/gameplay/dynamicData/planet/buildingData";
import * as BuildingUpgradeData from "@/lib/gameplay/dynamicData/planet/buildingUpgradeData";
import * as ClientRequestFunctions from "@/lib/networkRequests/client/clientRequestFunctions";

type TopBarProps =
{
	clientDataStateResult: UseClientDataState.ClientDataStateResult;
	cuController: UseCurrentUser.CUController;
	planetSelector: ReactElement;
};

function renderAbandonPlanetButton(props: TopBarProps): ReactElement
{
	const playerData: CoreType.PlayerData = props.clientDataStateResult.psController[0].predictedDBData;
	const ownedPlanetCount: number = playerData.planetDatas.length;
	const isDisabled: boolean = ownedPlanetCount <= 1;

	const handleAbandonPlanet = async (): Promise<void> =>
	{
		const errorMessage: string | null = await ClientRequestFunctions.clientTryAbandonPlanet(props.clientDataStateResult.psController);
		if (errorMessage !== null)
		{
			console.error("⚠️:", errorMessage);
		}
	};

	const buttonElement: ReactElement =
	(
		<button
			type="button"
			onClick={handleAbandonPlanet}
			disabled={isDisabled}
			className="border border-gray-400 px-3 py-1 rounded bg-red-600 hover:bg-red-500 disabled:bg-gray-400 disabled:cursor-not-allowed text-white text-sm font-semibold"
		>
			Abandon planet
		</button>
	);

	return buttonElement;
}

function renderDeleteAccountButton(props: TopBarProps, router: ReturnType<typeof useRouter>): ReactElement
{
	const handleDeleteAccount = async (): Promise<void> =>
	{
		const username: string | undefined = props.cuController[0].user?.username;
		if (username === undefined)
		{
			console.error("⚠️:", "Cannot delete account: username unavailable.");
			return;
		}

		try
		{
			await ClientRequestFunctions.clientTryDeleteUserRequest();
			router.push("/login");
		}
		catch (error: unknown)
		{
			console.error("⚠️:", error);
		}
	};

	const buttonElement: ReactElement =
	(
		<button
			type="button"
			onClick={handleDeleteAccount}
			className="border border-gray-400 px-3 py-1 rounded bg-red-600 hover:bg-red-500 text-white text-sm font-semibold"
		>
			Delete account
		</button>
	);

	return buttonElement;
}

function renderResourceCard(resourceDisplayValues: PlanetResourceDisplayValues, remainingMs: number | null): ReactElement
{
	const resourceName: string = ThingType.getSpecificThingName(ThingType.resource(resourceDisplayValues.resourceType));

	const buildLineElement: ReactElement | null = (resourceDisplayValues.affectedByCurrentBuild === true && remainingMs !== null)
		? <div className="text-sm">({TimeFormat.formatRemainingTimeMs(remainingMs)})</div>
		: null;

	const cardElement: ReactElement =
	(
		<div key={resourceDisplayValues.resourceType} className="flex flex-col items-center gap-1 border border-gray-400 rounded px-6 py-2">
			<div className="font-bold">{resourceName} {":"} {Math.floor(resourceDisplayValues.resource)}</div>
			<div>{Math.floor(resourceDisplayValues.productionRatePerHour)}/h</div>
			{buildLineElement}
		</div>
	);

	return cardElement;
}

export function TopBarElement(props: TopBarProps): ReactElement
{
	const router: ReturnType<typeof useRouter> = useRouter();
	const resourceTypes: number[] = ThingType.getAllSpecificThings(ThingType.Thing.Resource);

	try
	{
		const displayValues: PlanetDisplayValues = getPlanetDisplayValues(props.clientDataStateResult, resourceTypes);

		const cardElements: ReactElement[] = displayValues.resourceDisplayValues.map((resourceDisplayValues: PlanetResourceDisplayValues): ReactElement =>
		{
			return renderResourceCard(resourceDisplayValues, displayValues.remainingBuildingUpgradeMs);
		});

		const topBarElement: ReactElement =
		(
			<div className="bg-black/50 text-white py-3 px-4 flex items-start">
				<div className="flex items-center">
					{props.planetSelector}
				</div>
				<div className="flex-1 flex justify-center gap-4">
					{cardElements}
				</div>
				<div className="flex flex-col items-end gap-2">
					{renderAbandonPlanetButton(props)}
					{renderDeleteAccountButton(props, router)}
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
	remainingBuildingUpgradeMs: number | null;
};

export function getPlanetDisplayValues(clientDataStateResult: UseClientDataState.ClientDataStateResult, resourceTypes: number[]): PlanetDisplayValues
{
	const now: number = Date.now();

	const planetDataPredicted: CoreType.PlanetData = SelectedPlanet.getSelectedPlanetDataPredicted(clientDataStateResult.psController[0]);
	const buildingBeingUpgraded: number | null = BuildingUpgradeData.getBuildingTypeCurrentlyUpgrading(planetDataPredicted);

	const resourceDisplayValues: PlanetResourceDisplayValues[] = [];

	for (const resourceType of resourceTypes)
	{
		const calculatedNewResourceQuantity: number = ResourceData.getResourceQuantity(planetDataPredicted, resourceType);

		const productionRatePerSecond: number = BuildingData.getPlanetProductionRatePerSecond(planetDataPredicted, resourceType, clientDataStateResult.sdsController[0]);
		const productionRatePerHour: number = productionRatePerSecond * 3600;

		const affectedByCurrentBuild: boolean = (buildingBeingUpgraded !== null) && (BuildingData.doesBuildingProduceResource(buildingBeingUpgraded, resourceType) === true);

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
		remainingBuildingUpgradeMs: BuildingUpgradeData.getBuildingUpgradeRemainingMs(planetDataPredicted),
	};

	return displayValues;
}