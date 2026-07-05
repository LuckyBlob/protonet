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

export function findUserById(userId: number): DBType.UserRow | null
{
	const selectStatement: Database.Statement = DB.databaseConnection.prepare(
		"SELECT * FROM users WHERE id = ?"
	);
	const userRow: DBType.UserRow | undefined = selectStatement.get(userId) as DBType.UserRow | undefined;
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

export function deleteSessionsForUser(userId: number): void
{
	DB.databaseConnection.prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
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

function generateToken(): string
{
	return crypto.randomBytes(32).toString("hex");
}

export function createVerifyToken(userId: number): string
{
	const token: string = generateToken();
	DB.databaseConnection.prepare("UPDATE users SET verify_token = ? WHERE id = ?").run(token, userId);
	return token;
}

export function createResetToken(userId: number): string
{
	const token: string = generateToken();
	DB.databaseConnection.prepare("UPDATE users SET reset_token = ? WHERE id = ?").run(token, userId);
	return token;
}

export function findUserByVerifyToken(token: string): DBType.UserRow | null
{
	const userRow: DBType.UserRow | undefined = DB.databaseConnection.prepare(
		"SELECT * FROM users WHERE verify_token = ?"
	).get(token) as DBType.UserRow | undefined;
	return userRow ?? null;
}

export function findUserByResetToken(token: string): DBType.UserRow | null
{
	const userRow: DBType.UserRow | undefined = DB.databaseConnection.prepare(
		"SELECT * FROM users WHERE reset_token = ?"
	).get(token) as DBType.UserRow | undefined;
	return userRow ?? null;
}

export function clearVerifyToken(userId: number): void
{
	DB.databaseConnection.prepare("UPDATE users SET verify_token = NULL WHERE id = ?").run(userId);
}

export function clearResetToken(userId: number): void
{
	DB.databaseConnection.prepare("UPDATE users SET reset_token = NULL WHERE id = ?").run(userId);
}

export function normalizeEmail(email: string): string
{
	return email.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean
{
	const emailPattern: RegExp = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	return emailPattern.test(email);
}

export function findUserByEmail(email: string): DBType.UserRow | null
{
	const normalizedEmail: string = normalizeEmail(email);

	const userRow: DBType.UserRow | undefined = DB.databaseConnection.prepare(
		"SELECT * FROM users WHERE email = ?"
	).get(normalizedEmail) as DBType.UserRow | undefined;

	return userRow ?? null;
}

export function findUserByUsernameOrEmail(identifier: string): DBType.UserRow | null
{
	const userByUsername: DBType.UserRow | null = findUserByUsername(identifier);

	if (userByUsername !== null)
	{
		return userByUsername;
	}

	return findUserByEmail(identifier);
}

export function createUnverifiedUser(username: string, email: string, passwordHash: string): DBType.UserRow
{
	const normalizedEmail: string = normalizeEmail(email);
	const createdAt: number = Date.now();

	const insertStatement: Database.Statement = DB.databaseConnection.prepare(
		"INSERT INTO users (username, password_hash, email, email_verified, created_at, last_login_at) VALUES (?, ?, ?, 0, ?, ?) RETURNING *"
	);
	const userRow: DBType.UserRow = insertStatement.get(username, passwordHash, normalizedEmail, createdAt, createdAt) as DBType.UserRow;
	return userRow;
}

export function updateUnverifiedUser(userId: number, username: string, passwordHash: string): void
{
	DB.databaseConnection.prepare(
		"UPDATE users SET username = ?, password_hash = ? WHERE id = ? AND email_verified = 0"
	).run(username, passwordHash, userId);
}

export function setUserEmailVerified(userId: number): void
{
	DB.databaseConnection.prepare("UPDATE users SET email_verified = 1 WHERE id = ?").run(userId);
}

export function updateUserEmail(userId: number, email: string): void
{
	const normalizedEmail: string = normalizeEmail(email);
	DB.databaseConnection.prepare("UPDATE users SET email = ? WHERE id = ?").run(normalizedEmail, userId);
}

export function updateUserUsername(userId: number, username: string): void
{
	DB.databaseConnection.prepare("UPDATE users SET username = ? WHERE id = ?").run(username, userId);
}

export function updateUserPassword(userId: number, passwordHash: string): void
{
	DB.databaseConnection.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(passwordHash, userId);
}

export function updateUserLastLogin(userId: number, loginTime: number): void
{
	DB.databaseConnection.prepare("UPDATE users SET last_login_at = ? WHERE id = ?").run(loginTime, userId);
}