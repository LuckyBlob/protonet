import { ReactElement, ReactNode } from "react";

type ChildrenProps =
{
	children: ReactNode;
};

export function LightSurfaceElement(props: ChildrenProps): ReactElement
{
	const lightSurfaceElement: ReactElement =
	(
		<div className="surface-light min-h-screen flex flex-col">
			{props.children}
		</div>
	);

	return lightSurfaceElement;
}