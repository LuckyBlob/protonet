import { useRouter } from "next/navigation";

import * as AuthClient from "@/lib/authentication/authClient";
import * as UseClientDataState from "@/lib/use/useClientDataState";
import * as PlayerUpdateClient from "@/lib/update/client/playerUpdateClient";
import * as UseCurrentUser from "@/lib/use/useCurrentUser"

export async function handleLogout(router: ReturnType<typeof useRouter>): Promise<void>
{
	await AuthClient.tryLogout();
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
