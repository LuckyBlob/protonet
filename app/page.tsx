 "use client";

 import { useState } from "react";

export default function Home()
{
  const initialGold: number = 0;
  const goldState: [number, (value: number) => void] = useState<number>(initialGold);
  const setGold: (value: number) => void = goldState[1];
  const goldIncrementValue: number = 12;

  const incrementGoldByValue: () => void = () =>
  {
    const nextGold: number = goldState[0] + goldIncrementValue;
    setGold(nextGold);
  };

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
      onClick={incrementGoldByValue}
      className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
    >
      Increment gold by {goldIncrementValue}!
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