import { BackgroundElement } from "@/components/persistentComponents";

export function LoadingElement(): React.ReactElement
{
	const loadingElement: React.ReactElement =
	(
		<BackgroundElement>
			<main>
				Loading...
			</main>
		</BackgroundElement>
	);

	return loadingElement;
}
