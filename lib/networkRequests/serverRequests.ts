"use client";

import * as RequestType from "@/lib/networkRequests/requestTypes";
import * as APIEndPoint from "@/app/api/apiEndPoints"

export async function requestServerData<K extends keyof APIEndPoint.DataResponseMap>(dataRequest: { name: K; endpoint: string }): Promise<APIEndPoint.DataResponseMap[K] | null>
{
    try
    {
        const response: Response = await fetch(`/api/${dataRequest.endpoint}`);
        const parsed: unknown = await response.json();
        return handleServerDataResponse<K>(parsed, dataRequest.name);
    }
    catch (error: unknown)
    {
        const responseFailure: APIEndPoint.DataResponseMap[K] =
        {
            error: `Unknown ${dataRequest.name} error.`,
        } as APIEndPoint.DataResponseMap[K]

		console.error("⚠️:", `requestServerData ${dataRequest.name} failed:`, error);
        return responseFailure;
    }
}

function handleServerDataResponse<K extends keyof APIEndPoint.DataResponseMap>(parsed: unknown, actionName: string): APIEndPoint.DataResponseMap[K]
{
    if ((parsed === null) || (typeof parsed !== "object"))
    {
        const responseFailure: APIEndPoint.DataResponseMap[K] =
        {
            error: `Unknown ${actionName} error.`,
        } as APIEndPoint.DataResponseMap[K];

        return responseFailure;
    }

    const serverResponseData: APIEndPoint.DataResponseMap[K] = parsed as APIEndPoint.DataResponseMap[K];
    // Use != instead of !== here to catch everything that's very weird.
    if (serverResponseData.error != null)
    {
        const responseFailure: APIEndPoint.DataResponseMap[K] =
        {
            error: serverResponseData.error,
        } as APIEndPoint.DataResponseMap[K];

        return responseFailure;
    }

    return serverResponseData;
}

export async function requestServerAction<K extends keyof APIEndPoint.ActionResponseMap>(actionRequest: { name: K; endpoint: string }, clientRequest: APIEndPoint.ActionRequestMap[K]): Promise<APIEndPoint.ActionResponseMap[K]>
{
    try
    {
        const response: Response = await fetch(`/api/${actionRequest.endpoint}`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(clientRequest),
        });

        if (response.ok === false)
        {
            const errorText: string = await response.text();
            let errorMessage: string = `Unknown ${actionRequest.name} error.`;

            try
            {
                const parsedError: unknown = JSON.parse(errorText);
                if ((parsedError !== null) && (typeof parsedError === "object") && (typeof (parsedError as { error?: unknown }).error === "string"))
                {
                    errorMessage = (parsedError as { error: string }).error;
                }
            }
            catch
            {
                // Body wasn't JSON; keep default message.
            }

            const responseFailure: RequestType.BaseServerResponse =
            {
                error: errorMessage,
            };

            return responseFailure as APIEndPoint.ActionResponseMap[K];
        }

        const parsed: unknown = await response.json();

        return handleServerActionResponse<K>(parsed, actionRequest.name);
    }
    catch (error: unknown)
    {
        const responseFailure: RequestType.BaseServerResponse =
        {
            error: `Unknown ${actionRequest.name} error.`,
        }

		console.error("⚠️:", `requestServerAction ${actionRequest.name} failed:`, error);
        return responseFailure as APIEndPoint.ActionResponseMap[K];
    }
}

function handleServerActionResponse<K extends keyof APIEndPoint.ActionResponseMap>(parsed: unknown, actionName: string): APIEndPoint.ActionResponseMap[K]
{
    if ((parsed === null) || (typeof parsed !== "object"))
    {
        const responseFailure: RequestType.BaseServerResponse =
        {
            error: `Unknown ${actionName} error.`,
        }

        return responseFailure as APIEndPoint.ActionResponseMap[K];
    }

    const serverResponseData: APIEndPoint.ActionResponseMap[K] = parsed as APIEndPoint.ActionResponseMap[K];
    
    // Use != instead of !== here to catch everything that's very weird.
    if (serverResponseData.error != null)
    {
        const responseFailure: RequestType.BaseServerResponse =
        {
            error: serverResponseData.error,
        }

        return responseFailure as APIEndPoint.ActionResponseMap[K];
    }

    return serverResponseData;
}