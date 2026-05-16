import * as BackgroundElement from "@/components/layout/backgroundElement";

export function LoadingElement(): React.ReactElement
{
	const loadingElement: React.ReactElement =
	(
		<BackgroundElement.BackgroundElement>
			<main>
				Loading...
			</main>
		</BackgroundElement.BackgroundElement>
	);

	return loadingElement;
}