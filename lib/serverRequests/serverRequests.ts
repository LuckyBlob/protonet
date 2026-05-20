"use client";

import * as RequestType from "@/lib/serverRequests/requestTypes";
import { DataResponseMap, ActionResponseMap, ActionRequestMap } from "@/app/api/apiEndPoints"

export async function requestServerData<K extends keyof DataResponseMap>(dataRequest: { name: K; endpoint: string }): Promise<DataResponseMap[K] | null>
{
    try
    {
        const response: Response = await fetch(`/api/${dataRequest.endpoint}`);

        const parsed: unknown = await response.json();

        return handleServerDataResponse<K>(parsed, dataRequest.name);
    }
    catch (error: unknown)
    {
        const responseFailure: DataResponseMap[K] =
        {
            error: `Unknown ${dataRequest.name} error.`,
        } as DataResponseMap[K]

		console.warn("⚠️:", error); 
        return responseFailure;
    }
}

function handleServerDataResponse<K extends keyof DataResponseMap>(parsed: unknown, actionName: string): DataResponseMap[K]
{
    if ((parsed === null) || (typeof parsed !== "object"))
    {
        const responseFailure: DataResponseMap[K] =
        {
            error: `Unknown ${actionName} error.`,
        } as DataResponseMap[K];

        return responseFailure;
    }

    const serverResponseData: DataResponseMap[K] = parsed as DataResponseMap[K];
    if (serverResponseData.error != null)
    {
        const responseFailure: DataResponseMap[K] =
        {
            error: serverResponseData.error,
        } as DataResponseMap[K];

        return responseFailure;
    }

    return serverResponseData;
}

export async function requestServerAction<K extends keyof ActionResponseMap>(actionRequest: { name: K; endpoint: string }, clientRequest: ActionRequestMap[K]): Promise<ActionResponseMap[K]>
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
            const responseFailure: RequestType.BaseServerResponse =
            {
                error: `${actionRequest.name} failed: HTTP ${response.status}: ${errorText}`,
            };

            return responseFailure as ActionResponseMap[K];
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

		console.warn("⚠️:", error); 
        return responseFailure as ActionResponseMap[K];
    }
}

function handleServerActionResponse<K extends keyof ActionResponseMap>(parsed: unknown, actionName: string): ActionResponseMap[K]
{
    if ((parsed === null) || (typeof parsed !== "object"))
    {
        const responseFailure: RequestType.BaseServerResponse =
        {
            error: `Unknown ${actionName} error.`,
        }

        return responseFailure as ActionResponseMap[K];
    }

    const serverResponseData: ActionResponseMap[K] = parsed as ActionResponseMap[K];
    if (serverResponseData.error != null)
    {
        const responseFailure: RequestType.BaseServerResponse =
        {
            error: serverResponseData.error,
        }

        return responseFailure as ActionResponseMap[K];
    }

    return serverResponseData;
}