"use client";

import { useState, ReactElement, ChangeEvent } from "react";
import * as PlayerDataType from "@/lib/gameplay/gameplayData/player/playerDataTypes";

export function EmptyElement(): ReactElement
{
	const emptyElement: ReactElement =
	(
		<div></div>
	);

	return emptyElement;
}

export function renderShipImage(shipType: number): ReactElement
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

function getShipImagePath(shipType: number): string
{
    return `/ships/${shipType}.png`;
}

export type RequestedQuantitiesState =
{
	requestedQuantities: Map<number, number>;
	setRequestedQuantity: (type: number, value: number) => void;
	resetRequestedQuantities: () => void;
};
export function useRequestedQuantities(): RequestedQuantitiesState
{
	const [requestedQuantities, setRequestedQuantitiesMap] = useState<Map<number, number>>(new Map<number, number>());

	const setRequestedQuantity = (shipType: number, value: number): void =>
	{
		const updatedMap: Map<number, number> = new Map<number, number>(requestedQuantities);
		updatedMap.set(shipType, value);
		setRequestedQuantitiesMap(updatedMap);
	};

	const resetRequestedQuantities = (): void =>
	{
		setRequestedQuantitiesMap(new Map<number, number>());
	};

	return {
		requestedQuantities,
		setRequestedQuantity,
		resetRequestedQuantities,
	};
}

export function renderQuantityInput(type: number, min: number, max: number | null, requestedQuantity: number, fullPlanetData: PlayerDataType.FullPlanetData, setRequestedQuantity: (shipType: number, value: number) => void): ReactElement
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
