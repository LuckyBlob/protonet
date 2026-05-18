import { NextResponse } from "next/server";

import * as Auth from "@/lib/authentication/auth";
import * as DBType from "@/lib/db/dbTypes";
import * as RequestType from "@/lib/serverRequests/requestTypes";

export async function GET(): Promise<NextResponse>
{
	const failureRowRequest: RequestType.UserRowRequest =
	{
		userRow: null,
		error: "Unknown error."
	};

	const currentUserRow: DBType.UserRow | null = await Auth.getCurrentUser();

	if (currentUserRow === null)
	{
		failureRowRequest.error = "Didn't find user.";
		return NextResponse.json(failureRowRequest, { status: 401 });
	}

	const userRowRequest: RequestType.UserRowRequest =
	{
		userRow:
		{
			...currentUserRow,
			password_hash: "" // Don't send password hash to client
		},
		error: null,
	};

	return NextResponse.json(userRowRequest, { status: 200 });
}