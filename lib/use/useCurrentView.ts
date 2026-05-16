"use client";

import { useState } from "react";

export type CVController  = [string, (value: string) => void];

export function useCurrentView(): CVController
{
	const cvController: CVController = useState<string>("game");

	return cvController;
}