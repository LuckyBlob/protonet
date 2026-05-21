import bcrypt from "bcrypt";
import Database from "better-sqlite3";
import crypto from "crypto";
import { cookies } from "next/headers";
import { RequestCookie } from 'next/dist/compiled/@edge-runtime/cookies';
import { ReadonlyRequestCookies } from 'next/dist/server/web/spec-extension/adapters/request-cookies';

import * as DB from "@/lib/db/db";
import * as DBType from "@/lib/db/dbTypes";

export const sessionCookieName: string = "session_token";
export const sessionDurationSeconds: number = 60 * 60 * 24 * 30;

const bcryptSaltRounds: number = 10;
const sessionDurationMilliseconds: number = 1000 * 60 * 60 * 24 * 30; // 30 days

export async function hashPassword(plainPassword: string): Promise<string>
{
	const hashedPassword: string = await bcrypt.hash(plainPassword, bcryptSaltRounds);
	return hashedPassword;
}

export async function verifyPassword(plainPassword: string, passwordHash: string): Promise<boolean>
{
	const passwordIsValid: boolean = await bcrypt.compare(plainPassword, passwordHash);
	return passwordIsValid;
}

export function createUser(username: string, passwordHash: string): DBType.UserRow
{
	const createdAt: number = Date.now();

	const insertStatement: Database.Statement = DB.databaseConnection.prepare(
		"INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, ?) RETURNING *"
	);
	const userRow: DBType.UserRow = insertStatement.get(username, passwordHash, createdAt) as DBType.UserRow;
	return userRow;
}

export function deleteUser(userId: number): void
{
	const deleteStatement: Database.Statement = DB.databaseConnection.prepare(
		"DELETE FROM users WHERE id = ?"
	);
	deleteStatement.run(userId);

	// MUST RESET PLANETS HERE
}

export function findUserByUsername(username: string): DBType.UserRow | null
{
	const selectStatement: Database.Statement = DB.databaseConnection.prepare(
		"SELECT * FROM users WHERE username = ?"
	);
	const userRow: DBType.UserRow | undefined = selectStatement.get(username) as DBType.UserRow | undefined;
	return userRow ?? null;
}

export function createSession(userId: number): DBType.SessionRow
{
	const sessionToken: string = crypto.randomBytes(32).toString("hex");
	const expiresAt: number = Date.now() + sessionDurationMilliseconds;

	const insertStatement: Database.Statement = DB.databaseConnection.prepare(
		"INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)"
	);
	insertStatement.run(sessionToken, userId, expiresAt);

	const sessionRow: DBType.SessionRow =
	{
		token: sessionToken,
		user_id: userId,
		expires_at: expiresAt,
	};
	return sessionRow;
}

export function findSession(token: string): DBType.SessionRow | null
{
	const selectStatement: Database.Statement = DB.databaseConnection.prepare(
		"SELECT * FROM sessions WHERE token = ?"
	);
	const sessionRow: DBType.SessionRow | undefined = selectStatement.get(token) as DBType.SessionRow | undefined;

	if (sessionRow === undefined)
	{
		return null;
	}

	if (sessionRow.expires_at < Date.now())
	{
		deleteSession(token);
		return null;
	}

	return sessionRow;
}

export function deleteSession(token: string): void
{
	const deleteStatement: Database.Statement = DB.databaseConnection.prepare(
		"DELETE FROM sessions WHERE token = ?"
	);
	deleteStatement.run(token);
}

export async function getCurrentUser(): Promise<DBType.UserRow | null>
{
	const cookieStore: ReadonlyRequestCookies = await cookies();
	const sessionTokenCookie: RequestCookie | undefined = cookieStore.get(sessionCookieName);

	if (sessionTokenCookie === undefined)
	{
		return null;
	}

	const sessionRow: DBType.SessionRow | null = findSession(sessionTokenCookie.value);
	if (sessionRow === null)
	{
		return null;
	}

	const selectStatement: Database.Statement = DB.databaseConnection.prepare(
		"SELECT * FROM users WHERE id = ?"
	);
	const userRow: DBType.UserRow | undefined = selectStatement.get(sessionRow.user_id) as DBType.UserRow | undefined;
	return userRow ?? null;
}

export async function getCurrentAdminLevel(): Promise<number | null>
{
	const user: DBType.UserRow | null = await getCurrentUser();

	if (user === null)
	{
		return null;
	}

	return user.admin_level;
}