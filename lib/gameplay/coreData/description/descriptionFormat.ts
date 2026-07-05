export function formatNumber(value: number): string
{
	const rounded: number = Math.round(value * 1000) / 1000;

	return String(rounded);
}
