import { formatRemainingTimeMs } from "@/lib/helper/timeFormat";
import * as SelectedPlanetDisplay from "@/lib/update/client/selectedPlanetDisplay";
import * as UseLoadClientDataState from "@/lib/use/useLoadClientDataState";

type TopBarProps =
{
	clientDataStateResult: UseLoadClientDataState.ClientDataStateResult;
	planetSelector: React.ReactElement;
};

export function TopBarElement(props: TopBarProps): React.ReactElement
{
	const displayValues: SelectedPlanetDisplay.SelectedPlanetDisplayValues = SelectedPlanetDisplay.getSelectedPlanetDisplayValues(props.clientDataStateResult);

	const isBuilding: boolean = displayValues.buildCompletesAt !== 0;
	const remainingMs: number = displayValues.buildCompletesAt - Date.now();
	const buildHintText: string = isBuilding === true ? ` (${formatRemainingTimeMs(remainingMs)})` : "";

    const topBarElement: React.ReactElement =
    (
        <div className="h-[70px] bg-black/50 text-white pt-5 px-4 flex items-start">
            <div className="flex items-center">
                {props.planetSelector}
            </div>
            <div className="flex-1 flex justify-center gap-8">
                <div>🪨Iron: {displayValues.ressource}</div>
                <div>⛏️ Iron Rate: {displayValues.productionRatePerHour}/h{buildHintText}</div>
            </div>
        </div>
    );
    
	return topBarElement;
}