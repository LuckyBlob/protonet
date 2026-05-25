import { ReactElement } from "react";

import * as BackgroundElement from "@/components/layout/backgroundElement";

export function LoadingElement(): ReactElement
{
	const loadingElement: ReactElement =
	(
		<BackgroundElement.BackgroundElement>
			<main>
				Loading...
			</main>
		</BackgroundElement.BackgroundElement>
	);

	return loadingElement;
}