import * as BackgroundElement from "@/components/mainPageElements/backgroundElement";

type GameLayoutProps =
{
	sideBar: React.ReactNode;
	topBar: React.ReactNode;
	mainWindow: React.ReactNode;
};

export function GameLayoutElement(props: GameLayoutProps): React.ReactElement
{
	const layoutElement: React.ReactElement =
	(
		<BackgroundElement.BackgroundElement>
			<div className="min-h-screen flex">
				{props.sideBar}
				<div className="flex-1 flex flex-col">
					{props.topBar}
					<main className="flex-1 flex items-center justify-center p-8">
						{props.mainWindow}
					</main>
				</div>
			</div>
		</BackgroundElement.BackgroundElement>
	);

	return layoutElement;
}