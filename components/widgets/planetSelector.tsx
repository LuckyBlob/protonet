import { useState } from "react";

import * as UseClientDataState from "@/lib/use/useClientDataState";
import * as PlayerDataType from "@/lib/gameplay/gameplayData/player/playerDataTypes";
import * as SelectedPlanet from "@/lib/localStorage/selectedPlanet";

type PlanetSelectorProps =
{
	clientDataStateResult: UseClientDataState.ClientDataStateResult;
};

export function PlanetSelector(props: PlanetSelectorProps): React.ReactElement
{
	const isOpenState: [boolean, (value: boolean) => void] = useState<boolean>(false);
	const isOpen: boolean = isOpenState[0];
	const setIsOpen: (value: boolean) => void = isOpenState[1];

	const dropdownClass: string = isOpen === true ? "block" : "hidden";

	const planetsWithDisplayName: { fullPlanetData: PlayerDataType.FullPlanetData; displayName: string }[] = props.clientDataStateResult.psController[0].dbData.fullPlanetDatas.map((fullPlanetData: PlayerDataType.FullPlanetData) =>
	{
		const displayName: string = `${fullPlanetData.planetRow.slot}:${fullPlanetData.planetRow.system}:${fullPlanetData.planetRow.galaxy}`;

		return { fullPlanetData, displayName };
	});

	const handleToggleDropdown: () => void = () =>
	{
		setIsOpen(!isOpen);
	};


	const selectedFullPlanetData: PlayerDataType.FullPlanetData | undefined = props.clientDataStateResult.psController[0].dbData.fullPlanetDatas.find((fullPlanetData: PlayerDataType.FullPlanetData) =>
	{
		return fullPlanetData.planetRow.id === props.clientDataStateResult.psController[0].selectedPlanetId;
	});
	const selectedPlanetDisplayName: string = selectedFullPlanetData !== undefined
		? `(${selectedFullPlanetData.planetRow.slot}:${selectedFullPlanetData.planetRow.system}:${selectedFullPlanetData.planetRow.galaxy})`
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
				planetsWithDisplayName.map(({ fullPlanetData, displayName }: { fullPlanetData: PlayerDataType.FullPlanetData; displayName: string }) =>
				{
					const isSelected: boolean = props.clientDataStateResult.psController[0].selectedPlanetId === fullPlanetData.planetRow.id;
					const itemClass: string = isSelected === true
						? "bg-white/30 text-white"
						: "bg-transparent hover:bg-white/10 text-white/80 hover:text-white";

					return (
						<button
							key={fullPlanetData.planetRow.id}
							onClick={() => handleSelectPlanet(props.clientDataStateResult, fullPlanetData.planetRow.id, setIsOpen)}
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

async function handleSelectPlanet(clientDataStateResult: UseClientDataState.ClientDataStateResult, newPlanetID: number, setIsOpen: (value: boolean) => void): Promise<void>
{
	SelectedPlanet.setSelectedPlanetID(clientDataStateResult.psController, newPlanetID);
	setIsOpen(false);
};