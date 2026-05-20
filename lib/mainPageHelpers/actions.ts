import { useRouter } from "next/navigation";

import * as UseClientDataState from "@/lib/use/useClientDataState";
import * as PlayerUpdateClient from "@/lib/update/client/playerUpdateClient";
import * as UseCurrentUser from "@/lib/use/useCurrentUser"
import * as RequestType from "@/lib/serverRequests/requestTypes";
import * as ServerRequest from "@/lib/serverRequests/serverRequests"
import * as APIEndPoint from "@/app/api/apiEndPoints"

export async function handleLogout(router: ReturnType<typeof useRouter>): Promise<void>
{
    const serverResponse: APIEndPoint.ResponseForAction<typeof APIEndPoint.ActionRequest.Logout> = await ServerRequest.requestServerAction(APIEndPoint.ActionRequest.Logout, null);
    if (serverResponse.error !== null)
    {
        return;
    }

    router.push("/login");
};

export async function handleRefreshServerData(clientDataStateResult: UseClientDataState.ClientDataStateResult): Promise<void>
{
	await PlayerUpdateClient.tryRefreshServerData(clientDataStateResult);
};

export function shouldShowLoading(cuController: UseCurrentUser.CUController, clientDataStateResult: UseClientDataState.ClientDataStateResult): boolean
{
    if (cuController[0].isLoading || clientDataStateResult.lsController[0].isLoading)
    {
        return true;
    }

    if (cuController[0].user === null)
    {
        return true;
    }

    return false;
}
