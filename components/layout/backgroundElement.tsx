import { ReactElement, ReactNode } from "react";

type ChildrenProps =
{
	children: ReactNode;
};

export function BackgroundElement(props: ChildrenProps): ReactElement
{
	const backgroundElement: ReactElement =
	(
		<div
			className="surface-dark min-h-screen flex flex-col bg-center bg-repeat"
			style=
			{{
				backgroundImage: "url('/background.png')",
				backgroundSize: "600px 600px",
			}}>
			{props.children}
		</div>
	);

	return backgroundElement;
}