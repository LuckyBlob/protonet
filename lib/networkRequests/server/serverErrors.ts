import { NextResponse } from "next/server";

// Typed errors that the server route handlers throw to signal a specific
// HTTP failure mode. Each carries its own statusCode so the central
// respondWithError() helper can map any thrown error to the right response
// without each handler hand-rolling { status: 401 } / { status: 404 } / etc.

export class HttpError extends Error
{
    readonly statusCode: number;

    constructor(message: string, statusCode: number)
    {
        super(message);
        this.name = this.constructor.name;
        this.statusCode = statusCode;
    }
}

// 400 — request was syntactically or semantically wrong (bad input, business
// rule violation surfaced from a try*Logic helper).
export class ValidationError extends HttpError
{
    constructor(message: string)
    {
        super(message, 400);
    }
}

// 401 — caller is not authenticated (no session, expired session, missing user).
export class AuthError extends HttpError
{
    constructor(message: string)
    {
        super(message, 401);
    }
}

// 403 — caller is authenticated but not allowed to perform this action
// (e.g. non-admin hitting an admin endpoint).
export class ForbiddenError extends HttpError
{
    constructor(message: string)
    {
        super(message, 403);
    }
}

// 404 — the resource doesn't exist (player row missing, message missing, etc.).
export class NotFoundError extends HttpError
{
    constructor(message: string)
    {
        super(message, 404);
    }
}

// Maps any thrown value to a NextResponse using the typed error's statusCode
// when available, or 500 otherwise. errorResponseTemplate carries the
// endpoint-specific "null payload" shape (userRow: null, serializedPlayerData: null, …);
// this helper only sets .error and the HTTP status, never touches the rest.
export function respondWithError<T extends { error: string | null }>(error: unknown, errorResponseTemplate: T): NextResponse
{
    if (error instanceof HttpError)
    {
        errorResponseTemplate.error = error.message;
        return NextResponse.json(errorResponseTemplate, { status: error.statusCode });
    }

    if (error instanceof Error)
    {
        errorResponseTemplate.error = error.message;
        return NextResponse.json(errorResponseTemplate, { status: 500 });
    }

    errorResponseTemplate.error = String(error);
    return NextResponse.json(errorResponseTemplate, { status: 500 });
}
