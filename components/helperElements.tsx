"use client";

import { useState, ReactElement, ReactNode, ChangeEvent } from "react";
import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as ThingHelpers from "@/lib/gameplay/coreData/thing/thingHelpers";
import * as ThingDataHelpers from "@/lib/gameplay/coreData/thing/thingDataHelpers";
import * as GameType from "@/lib/gameplay/coreData/type/gameTypes";

export function EmptyElement(): ReactElement
{
	const emptyElement: ReactElement =
	(
		<div></div>
	);

	return emptyElement;
}

export function renderShipImage(shipType: GameType.ShipType): ReactElement
{
	const imagePath: string = getShipImagePath(shipType);
	const element: ReactElement =
	(
		<div className="w-24 h-24 flex flex-col items-center justify-center text-center">
			<img
				src={imagePath}
				alt=""
				className="w-24 h-24 object-contain"
				onError={(e) =>
				{
					e.currentTarget.style.display = "none";
					const fallback: HTMLElement | null = e.currentTarget.nextElementSibling as HTMLElement | null;
					if (fallback !== null)
					{
						fallback.style.display = "flex";
					}
				}}
			/>
			<div className="hidden flex-col items-center justify-center text-xs gap-1">
				<span>[Image]</span>
			</div>
		</div>
	);

	return element;
}

function getShipImagePath(shipType: GameType.ShipType): string
{
    return `/ships/${shipType}.png`;
}

export type RequestedQuantitiesState<K extends number> =
{
	requestedQuantities: Map<K, number>;
	setRequestedQuantity: (type: K, value: number) => void;
	resetRequestedQuantities: () => void;
};
export function useRequestedQuantities<K extends number>(): RequestedQuantitiesState<K>
{
	const [requestedQuantities, setRequestedQuantitiesMap] = useState<Map<K, number>>(new Map<K, number>());

	const setRequestedQuantity = (shipType: K, value: number): void =>
	{
		const updatedMap: Map<K, number> = new Map<K, number>(requestedQuantities);

		if (value <= 0)
		{
			updatedMap.delete(shipType);
		}
		else
		{
			updatedMap.set(shipType, value);
		}

		setRequestedQuantitiesMap(updatedMap);
	};

	const resetRequestedQuantities = (): void =>
	{
		setRequestedQuantitiesMap(new Map<K, number>());
	};

	return {
		requestedQuantities,
		setRequestedQuantity,
		resetRequestedQuantities,
	};
}

export function renderQuantityInput<K extends number>(type: K, min: number, max: number | null, requestedQuantity: number, planetData: CoreType.PlanetData, setRequestedQuantity: (type: K, value: number) => void): ReactElement
{
	const handleQuantityChange = (e: ChangeEvent<HTMLInputElement>): void =>
	{
		const parsedValue: number = Number.parseInt(e.target.value, 10);

		if (Number.isNaN(parsedValue) || parsedValue < 0)
		{
			setRequestedQuantity(type, min);
			return;
		}
		
		if (max !== null)
		{
			setRequestedQuantity(type, Math.min(Math.max(parsedValue, min), max));
		}
		else
		{
			setRequestedQuantity(type, Math.max(parsedValue, min));
		}
	};

	const element: ReactElement =
	(
		<input
			type="number"
			min={min}
			max={max ?? undefined}
			value={requestedQuantity}
			onChange={handleQuantityChange}
			size={Math.max(String(requestedQuantity).length, 2)}
			className="border border-gray-400 px-2 py-1 rounded bg-white text-black w-auto"
		/>
	);

	return element;
}

export function buildCostParts(costMap: Map<GameType.ResourceType, number>): string[]
{
	const costParts: string[] = [];

	for (const [resourceType, resourceCost] of costMap)
	{
		costParts.push(`${resourceCost} ${ThingDataHelpers.getSpecificThingName(ThingHelpers.resource(resourceType))}`);
	}

	return costParts;
}
