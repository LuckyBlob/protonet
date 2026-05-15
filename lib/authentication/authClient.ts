export type AuthResult =
{
	success: boolean;
	username: string | null;
	errorMessage: string | null;
};

export async function tryRegister(username: string, password: string): Promise<AuthResult>
{
	const response: Response = await fetch("/api/register",
	{
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ username, password }),
	});

	const responseData: { username?: string; error?: string } = await response.json();

	if (response.ok === false)
	{
		const failureResult: AuthResult =
		{
			success: false,
			username: null,
			errorMessage: responseData.error ?? "Registration failed",
		};
		return failureResult;
	}

	const successResult: AuthResult =
	{
		success: true,
		username: responseData.username ?? null,
		errorMessage: null,
	};
	return successResult;
}

export async function tryLogin(username: string, password: string): Promise<AuthResult>
{
	const response: Response = await fetch("/api/login",
	{
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ username, password }),
	});

	const responseData: { username?: string; error?: string } = await response.json();

	if (response.ok === false)
	{
		const failureResult: AuthResult =
		{
			success: false,
			username: null,
			errorMessage: responseData.error ?? "Login failed",
		};
		return failureResult;
	}

	const successResult: AuthResult =
	{
		success: true,
		username: responseData.username ?? null,
		errorMessage: null,
	};
	return successResult;
}

export async function tryLogout(): Promise<void>
{
	await fetch("/api/logout", { method: "POST" });
}