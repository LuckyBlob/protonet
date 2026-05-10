import { PlayerRow } from "@/lib/dbTypes";


export type CurrentPredictedValues =
{
    gold: number;
};

export type PlayerState =
{
    dbData: PlayerRow;
    lastFetchTimestamp: number;
    currentPredictedValues: CurrentPredictedValues
};

export type PSController  = [PlayerState, (value: PlayerState) => void];

export const NullPredictedValues: CurrentPredictedValues =
{
    gold: 0
};

export const NullPlayerRow: PlayerRow =
{
  id: 0,
  gold: 0,
  production_rate: 0,
  last_updated: 0
};

export const NullPlayerState: PlayerState =
{
    dbData: NullPlayerRow,
    lastFetchTimestamp: 0,
    currentPredictedValues: NullPredictedValues,
};