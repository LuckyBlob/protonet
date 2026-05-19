import { NextResponse } from "next/server";

import * as Auth from "@/lib/authentication/auth";
import * as DBType from "@/lib/db/dbTypes";
import * as APIEndPoint from "@/app/api/apiEndPoints"

export async function GET(): Promise<NextResponse>
{
	const errorServerResponse: APIEndPoint.ResponseForData<typeof APIEndPoint.DataRequest.UserInfo> =
	{
		error: "Unknown error.",
		userRow: null,
	}

	let currentUserRow: DBType.UserRow | null = null;
	try
	{
		currentUserRow = await Auth.getCurrentUser();
		if (currentUserRow === null)
		{
			errorServerResponse.error = "Didn't find user.";
			return NextResponse.json(errorServerResponse, { status: 401 });
		}
	}
	catch (error: unknown)
	{
		const errorMessage: string = error instanceof Error ? error.message : String(error);

		errorServerResponse.error = errorMessage;
		return NextResponse.json(errorServerResponse, { status: 500 });
	}

	return NextResponse.json<APIEndPoint.ResponseForData<typeof APIEndPoint.DataRequest.UserInfo>>(
	{
		error: null,
		userRow:
		{
			...currentUserRow,
			password_hash: "" // Don't send password hash to client
		},
	}, { status: 200 });
}
