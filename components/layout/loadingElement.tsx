import { ReactElement } from "react";

import * as BackgroundElement from "@/components/layout/backgroundElement";

type LoadingElementProps =
{
	error?: string | null;
};

export function LoadingElement(props: LoadingElementProps): ReactElement
{
	const hasError: boolean = props.error !== undefined && props.error !== null;

	const mainElement: ReactElement = hasError
		? <main className="text-red-400">{props.error}</main>
		: <main>Loading...</main>;

	const loadingElement: ReactElement =
	(
		<BackgroundElement.BackgroundElement>
			{mainElement}
		</BackgroundElement.BackgroundElement>
	);

	return loadingElement;
}
