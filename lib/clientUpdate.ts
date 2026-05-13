import * as MainPageTypes from "@/lib/mainPageTypes";
import * as UpgradeCost from "@/lib/upgradeCost";

const tickIntervalMilliseconds: number = 1000;

function clientUpdatePredictedGold(psController: MainPageTypes.PSController, sdsController: MainPageTypes.SDSController, elapsedSeconds: number): void
{
    const predictedGold: number = psController[0].dbData.gold + (UpgradeCost.getProductionRate(psController[0].dbData, sdsController[0]) * elapsedSeconds);

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

function clientUpdatePredictedValues(psController: MainPageTypes.PSController, sdsController: MainPageTypes.SDSController, elapsedSeconds: number): void
{
    clientUpdatePredictedGold(psController, sdsController, elapsedSeconds);
}

function clientTick(psController: MainPageTypes.PSController, sdsController: MainPageTypes.SDSController): void
{
    const currentTimestamp: number = Date.now();
    const elapsedSeconds: number = (currentTimestamp - psController[0].lastFetchTimestamp) / 1000;

    clientUpdatePredictedValues(psController, sdsController, elapsedSeconds);
}

export function addAnimationTimer(psController: MainPageTypes.PSController, sdsController: MainPageTypes.SDSController): () => void
{
    const intervalId: NodeJS.Timeout = setInterval(() =>
    {
      clientTick(psController, sdsController);
    }, tickIntervalMilliseconds);

    const cleanupFunction: () => void = () =>
	{
		clearInterval(intervalId);
	};

	return cleanupFunction;
}
