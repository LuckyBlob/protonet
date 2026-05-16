type ChildrenProps =
{
	children: React.ReactNode;
};

export function LightSurfaceElement(props: ChildrenProps): React.ReactElement
{
	const lightSurfaceElement: React.ReactElement =
	(
		<div className="surface-light min-h-screen flex flex-col">
			{props.children}
		</div>
	);

	return lightSurfaceElement;
}