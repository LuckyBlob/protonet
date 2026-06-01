// Runtime validators for client-request JSON bodies. Each route's handler
// pipes the raw `await request.json()` value through the matching validator
// before passing it on, so the downstream try*Logic helpers can trust the
// shape of their input. Bad shape throws ValidationError -> respondWithError
// turns that into a 400 response.

import * as APIEndPoint from "@/app/api/apiEndPoints";
import * as Serialization from "@/lib/helper/serialization";
import * as ServerError from "@/lib/networkRequests/server/serverErrors";

//#region primitive assertions
function assertPlainObject(value: unknown, requestName: string): Record<string, unknown>
{
    if (value === null || typeof value !== "object" || Array.isArray(value) === true)
    {
        throw new ServerError.ValidationError(`${requestName} request body must be a JSON object.`);
    }

    return value as Record<string, unknown>;
}

function assertString(value: unknown, requestName: string, fieldName: string): string
{
    if (typeof value !== "string")
    {
        throw new ServerError.ValidationError(`${requestName} request: field "${fieldName}" must be a string.`);
    }

    return value;
}

function assertFiniteNumber(value: unknown, requestName: string, fieldName: string): number
{
    if (typeof value !== "number" || Number.isFinite(value) === false)
    {
        throw new ServerError.ValidationError(`${requestName} request: field "${fieldName}" must be a finite number.`);
    }

    return value;
}

function assertSerializedNumberNumberMap(value: unknown, requestName: string, fieldName: string): Serialization.SerializedNumberNumberMap
{
    const wrapper: Record<string, unknown> = assertPlainObject(value, `${requestName} (field "${fieldName}")`);
    const serializedMap: unknown = wrapper.serializedMap;
    if (Array.isArray(serializedMap) === false)
    {
        throw new ServerError.ValidationError(`${requestName} request: field "${fieldName}.serializedMap" must be an array.`);
    }

    for (const pair of serializedMap)
    {
        if (Array.isArray(pair) === false || pair.length !== 2 || typeof pair[0] !== "number" || typeof pair[1] !== "number")
        {
            throw new ServerError.ValidationError(`${requestName} request: every entry of "${fieldName}.serializedMap" must be a [number, number] pair.`);
        }
    }

    const validated: Serialization.SerializedNumberNumberMap =
    {
        serializedMap: serializedMap as [number, number][],
    };

    return validated;
}
//#endregion

//#region request body parsing
// request.json() throws SyntaxError on a non-JSON body. Wrap so that a
// malformed body becomes a typed ValidationError (400) rather than the
// generic 500 our central handler would emit for an unknown Error.
export async function parseRequestJson(request: Request, requestName: string): Promise<unknown>
{
    try
    {
        return await request.json();
    }
    catch (error: unknown)
    {
        throw new ServerError.ValidationError(`${requestName} request body must be valid JSON.`);
    }
}
//#endregion

//#region per-request validators
export function validateLoginRequest(raw: unknown): APIEndPoint.RequestForAction<typeof APIEndPoint.ActionRequest.Login>
{
    const body: Record<string, unknown> = assertPlainObject(raw, "Login");
    const validated: APIEndPoint.RequestForAction<typeof APIEndPoint.ActionRequest.Login> =
    {
        username: assertString(body.username, "Login", "username"),
        password: assertString(body.password, "Login", "password"),
    };

    return validated;
}

export function validateRegisterRequest(raw: unknown): APIEndPoint.RequestForAction<typeof APIEndPoint.ActionRequest.Register>
{
    const body: Record<string, unknown> = assertPlainObject(raw, "Register");
    const validated: APIEndPoint.RequestForAction<typeof APIEndPoint.ActionRequest.Register> =
    {
        username: assertString(body.username, "Register", "username"),
        password: assertString(body.password, "Register", "password"),
    };

    return validated;
}

export function validateUpgradeBuildingRequest(raw: unknown): APIEndPoint.RequestForAction<typeof APIEndPoint.ActionRequest.UpgradeBuilding>
{
    const body: Record<string, unknown> = assertPlainObject(raw, "UpgradeBuilding");
    const validated: APIEndPoint.RequestForAction<typeof APIEndPoint.ActionRequest.UpgradeBuilding> =
    {
        buildingType: assertFiniteNumber(body.buildingType, "UpgradeBuilding", "buildingType"),
        planetId: assertFiniteNumber(body.planetId, "UpgradeBuilding", "planetId"),
    };

    return validated;
}

export function validateBuildShipsRequest(raw: unknown): APIEndPoint.RequestForAction<typeof APIEndPoint.ActionRequest.BuildShips>
{
    const body: Record<string, unknown> = assertPlainObject(raw, "BuildShips");
    const validated: APIEndPoint.RequestForAction<typeof APIEndPoint.ActionRequest.BuildShips> =
    {
        planetId: assertFiniteNumber(body.planetId, "BuildShips", "planetId"),
        serializedShipQuantities: assertSerializedNumberNumberMap(body.serializedShipQuantities, "BuildShips", "serializedShipQuantities"),
    };

    return validated;
}

export function validateSendFleetRequest(raw: unknown): APIEndPoint.RequestForAction<typeof APIEndPoint.ActionRequest.SendFleet>
{
    const body: Record<string, unknown> = assertPlainObject(raw, "SendFleet");
    const validated: APIEndPoint.RequestForAction<typeof APIEndPoint.ActionRequest.SendFleet> =
    {
        originPlanetId: assertFiniteNumber(body.originPlanetId, "SendFleet", "originPlanetId"),
        targetPlanetGalaxy: assertFiniteNumber(body.targetPlanetGalaxy, "SendFleet", "targetPlanetGalaxy"),
        targetPlanetSystem: assertFiniteNumber(body.targetPlanetSystem, "SendFleet", "targetPlanetSystem"),
        targetPlanetPosition: assertFiniteNumber(body.targetPlanetPosition, "SendFleet", "targetPlanetPosition"),
        fleetAction: assertFiniteNumber(body.fleetAction, "SendFleet", "fleetAction"),
        serializedShipQuantities: assertSerializedNumberNumberMap(body.serializedShipQuantities, "SendFleet", "serializedShipQuantities"),
        serializedResourceQuantities: assertSerializedNumberNumberMap(body.serializedResourceQuantities, "SendFleet", "serializedResourceQuantities"),
    };

    return validated;
}

export function validateAbandonPlanetRequest(raw: unknown): APIEndPoint.RequestForAction<typeof APIEndPoint.ActionRequest.AbandonPlanet>
{
    const body: Record<string, unknown> = assertPlainObject(raw, "AbandonPlanet");
    const validated: APIEndPoint.RequestForAction<typeof APIEndPoint.ActionRequest.AbandonPlanet> =
    {
        planetId: assertFiniteNumber(body.planetId, "AbandonPlanet", "planetId"),
    };

    return validated;
}
//#endregion
