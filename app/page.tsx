 "use client";

import { PlayerRow } from "@/lib/dbTypes";
import { useEffect, useState } from "react";

export default function Home()
{
  const loadingElement: React.ReactElement =
  (
    <main>
      Loading...
    </main>
  );
  const initialGold: number = 0;
  const goldState: [number, (value: number) => void] = useState<number>(initialGold);
  const setGold: (value: number) => void = goldState[1];

  const isLoadingState: [boolean, (value: boolean) => void] = useState<boolean>(true);
  const setIsLoading: (value: boolean) => void = isLoadingState[1];

  const fetchPlayer1Gold: () => Promise<void> = async () =>
  {
    const response: Response = await fetch("/api/state");
    const data: PlayerRow = await response.json();

    setGold(data.gold);
    setIsLoading(false);
  };

  useEffect(() =>
  {
    fetchPlayer1Gold();
  }, []);

  const incrementGold: () => Promise<void> = async () =>
  {
    const response: Response = await fetch("/api/click", { method: "POST" });
    const data: PlayerRow = await response.json();

    setGold(data.gold);
  };

  if (isLoadingState[0] === true)
  {
    return loadingElement;
  }

  const showGoldComponent: React.ReactElement =
  (
    <div>
      Gold: {goldState[0]}
    </div>
  );

  const incrementGoldButton: React.ReactElement =
  (
    <
      button
      onClick={incrementGold}
      className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
    >
      Increment gold by 1!
    </button>
  );

  const pageComponent: React.ReactElement =
  (
    <main>
      {showGoldComponent}
      {incrementGoldButton}
    </main>
  );

  return pageComponent;
}