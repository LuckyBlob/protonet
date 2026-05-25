import { ReactElement, ReactNode } from "react";

import * as BackgroundElement from "@/components/layout/backgroundElement";

type GameLayoutProps =
{
	sideBar: ReactNode;
	topBar: ReactNode;
	mainWindow: ReactNode;
};

export function GameLayoutElement(props: GameLayoutProps): ReactElement
{
	const layoutElement: ReactElement =
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