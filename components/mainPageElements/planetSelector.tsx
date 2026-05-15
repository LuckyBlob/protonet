import { useState } from "react";
import * as MainPageType from "@/lib/mainPageTypes";

import * as DBType from "@/lib/db/dbTypes";
import * as UseLoadClientDataState from "@/lib/use/useLoadClientDataState";
import * as SelectedPlanet from "@/lib/localStorage/selectedPlanet";

type PlanetSelectorProps =
{
	clientDataStateResult: UseLoadClientDataState.ClientDataStateResult;
};

export function PlanetSelector(props: PlanetSelectorProps): React.ReactElement
{
	const isOpenState: [boolean, (value: boolean) => void] = useState<boolean>(false);
	const isOpen: boolean = isOpenState[0];
	const setIsOpen: (value: boolean) => void = isOpenState[1];

    const dropdownClass: string = isOpen === true ? "block" : "hidden";

	const planetsWithDisplayName: { planet: DBType.PlanetRow; displayName: string }[] = props.clientDataStateResult.psController[0].dbData.planetRows.map((planet: DBType.PlanetRow) =>
	{
		const displayName: string = `${planet.slot}:${planet.system}:${planet.galaxy}`;

		return { planet, displayName };
	});

	const handleToggleDropdown: () => void = () =>
	{
		setIsOpen(!isOpen);
	};


	const selectedPlanet: DBType.PlanetRow | undefined = props.clientDataStateResult.psController[0].dbData.planetRows.find((planetRow: DBType.PlanetRow) =>
	{
		return planetRow.id === props.clientDataStateResult.psController[0].selectedPlanetId;
	});
	const selectedPlanetDisplayName: string = selectedPlanet !== undefined
		? `(${selectedPlanet.slot}:${selectedPlanet.system}:${selectedPlanet.galaxy})`
		: "...";

	const selectorElement: React.ReactElement =
	(
		<div className="relative inline-block">
			<button
				onClick={handleToggleDropdown}
				className="px-4 py-2 bg-black/70 hover:bg-black/80 rounded text-white text-sm font-semibold transition-colors border border-white/30"
			>
				Planet {selectedPlanetDisplayName}
			</button>
			<div
				className={`absolute top-full left-0 mt-1 w-max bg-black/90 border border-white/20 rounded shadow-lg z-50 ${dropdownClass}`}
			>
			{
				planetsWithDisplayName.map(({ planet, displayName }: { planet: DBType.PlanetRow; displayName: string }) =>
				{
					const isSelected: boolean = props.clientDataStateResult.psController[0].selectedPlanetId === planet.id;
					const itemClass: string = isSelected === true
						? "bg-white/30 text-white"
						: "bg-transparent hover:bg-white/10 text-white/80 hover:text-white";

					return (
						<button
							key={planet.id}
							onClick={() => handleSelectPlanet(props.clientDataStateResult, planet.id, setIsOpen)}
							className={`block w-full text-left px-4 py-2 text-sm transition-colors ${itemClass}`}
						>
							{displayName}
						</button>
					);
				})
			}
			</div>
		</div>
	);


	return selectorElement;
}

async function handleSelectPlanet(clientDataStateResult: UseLoadClientDataState.ClientDataStateResult, newPlanetID: number, setIsOpen: (value: boolean) => void): Promise<void>
{
	SelectedPlanet.setSelectedPlanetInPlayerState(clientDataStateResult, newPlanetID);
	setIsOpen(false);
};