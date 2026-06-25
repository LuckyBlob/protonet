import { useState } from "react";
import { ReactElement, ReactNode } from "react";

import * as UseClientDataState from "@/lib/use/useClientDataState";
import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as SelectedPlanet from "@/lib/localStorage/selectedPlanet";
import * as StaticDataHelper from "@/lib/gameplay/coreData/static/staticDataHelpers";

type PlanetSelectorProps =
{
	clientDataStateResult: UseClientDataState.ClientDataStateResult;
};

export function PlanetSelector(props: PlanetSelectorProps): ReactElement
{
	const isOpenState: [boolean, (value: boolean) => void] = useState<boolean>(false);
	const isOpen: boolean = isOpenState[0];
	const setIsOpen: (value: boolean) => void = isOpenState[1];

	const selectableZones: CoreType.PlanetData[] = StaticDataHelper.getSelectableZones(props.clientDataStateResult.psController[0].dbData.planetDatas);
	const planetsWithDisplayName: { planetData: CoreType.PlanetData; displayName: string }[] = selectableZones.map((planetData: CoreType.PlanetData) =>
	{
		const displayName: string = StaticDataHelper.getPlanetDisplayName(planetData.planetRow);

		return { planetData, displayName };
	});

	const handleToggleDropdown: () => void = () =>
	{
		setIsOpen(!isOpen);
	};


	const selectedPlanetData: CoreType.PlanetData | undefined = props.clientDataStateResult.psController[0].dbData.planetDatas.find((planetData: CoreType.PlanetData) =>
	{
		return planetData.planetRow.id === props.clientDataStateResult.psController[0].selectedPlanetId;
	});
	const selectedPlanetDisplayName: string = selectedPlanetData !== undefined
		? StaticDataHelper.getPlanetDisplayName(selectedPlanetData.planetRow)
		: "...";

	const selectorElement: ReactElement =
	(
		<div className="relative inline-block">
			<button
				onClick={handleToggleDropdown}
				className="px-4 py-2 bg-black/70 hover:bg-black/80 rounded text-white text-sm font-semibold transition-colors border border-white/30"
			>
				Planet {selectedPlanetDisplayName}
			</button>
			{isOpen === true ?
			(
				<div className="absolute top-full left-0 mt-1 w-max bg-black/90 border border-white/20 rounded shadow-lg z-50">
				{
					planetsWithDisplayName.map(({ planetData, displayName }: { planetData: CoreType.PlanetData; displayName: string }) =>
					{
						const isSelected: boolean = props.clientDataStateResult.psController[0].selectedPlanetId === planetData.planetRow.id;
						const itemClass: string = isSelected === true
							? "bg-white/30 text-white"
							: "bg-transparent hover:bg-white/10 text-white/80 hover:text-white";

						return (
							<button
								key={planetData.planetRow.id}
								onClick={() => handleSelectPlanet(props.clientDataStateResult, planetData.planetRow.id, setIsOpen)}
								className={`block w-full text-left px-4 py-2 text-sm transition-colors ${itemClass}`}
							>
								{displayName}
							</button>
						);
					})
				}
				</div>
			) : null}
		</div>
	);


	return selectorElement;
}

async function handleSelectPlanet(clientDataStateResult: UseClientDataState.ClientDataStateResult, newPlanetID: number, setIsOpen: (value: boolean) => void): Promise<void>
{
	SelectedPlanet.setSelectedPlanetID(clientDataStateResult.psController, newPlanetID);
	setIsOpen(false);
};