import * as BackgroundElement from "@/components/mainPageElements/backgroundElement";

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