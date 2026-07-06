export function formatRemainingTimeMs(remainingMs: number): string
{
	if (remainingMs <= 0)
	{
		return "0s";
	}

	const totalSeconds: number = Math.floor(remainingMs / 1000);
	const totalMinutes: number = Math.floor(totalSeconds / 60);
	const totalHours: number = Math.floor(totalMinutes / 60);

	const days: number = Math.floor(totalHours / 24);
	const hours: number = totalHours % 24;
	const minutes: number = totalMinutes % 60;
	const seconds: number = totalSeconds % 60;

	if (days > 0)
	{
		return `${days}d ${hours}h ${minutes}m ${seconds}s`;
	}

	if (hours > 0)
	{
		return `${hours}h ${minutes}m ${seconds}s`;
	}

	if (minutes > 0)
	{
		return `${minutes}m ${seconds}s`;
	}

	return `${seconds}s`;
}