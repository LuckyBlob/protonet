"use client";

import { useState } from "react";

import * as MainPageType from "@/lib/mainPageTypes";

export function useCurrentView(): MainPageType.CVController
{
	const cvController: MainPageType.CVController = useState<string>("game");

	return cvController;
}