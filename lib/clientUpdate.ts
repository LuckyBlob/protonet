import * as MainPageTypes from "@/lib/mainPageTypes";
import * as UpgradeCost from "@/lib/upgradeCost";

const tickIntervalMilliseconds: number = 1000;

function clientUpdatePredictedGold(psController: MainPageTypes.PSController, elapsedSeconds: number): void
{
    const predictedGold: number = psController[0].dbData.gold + (UpgradeCost.getProductionRate(psController[0].dbData) * elapsedSeconds);

    const updatedPlayerState: MainPageTypes.PlayerState =
    {
        ...psController[0],
        currentPredictedValues:
        {
            ...psController[0].currentPredictedValues,
            gold: predictedGold,
        },
    };

    psController[1](updatedPlayerState);
}

function clientUpdatePredictedValues(psController: MainPageTypes.PSController, elapsedSeconds: number): void
{
    clientUpdatePredictedGold(psController, elapsedSeconds);
}

function clientTick(psController: MainPageTypes.PSController): void
{
    const currentTimestamp: number = Date.now();
    const elapsedSeconds: number = (currentTimestamp - psController[0].lastFetchTimestamp) / 1000;

    clientUpdatePredictedValues(psController, elapsedSeconds);
}

export function addAnimationTimer(psController: MainPageTypes.PSController): () => void
{
    const intervalId: NodeJS.Timeout = setInterval(() =>
    {
      clientTick(psController);
    }, tickIntervalMilliseconds);

    const cleanupFunction: () => void = () =>
	{
		clearInterval(intervalId);
	};

	return cleanupFunction;
}
