import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { db } from "@/lib/db";

/**
 * GameVault auth — JWT session in an httpOnly cookie.
 *  - passwords hashed with bcrypt (cost 12)
 *  - session token signed HS256 (jose), 30-day expiry
 *  - verified server-side on every API route via requireUser()
 */

export const SESSION_COOKIE = process.env.AUTH_COOKIE_NAME || "gv_session";
const SESSION_DAYS = 30;

function secretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET is required in production");
  }
  return new TextEncoder().encode(secret);
}

export type SessionPayload = { userId: string; username: string };

// ---------- passwords ----------
export const hashPassword = (pw: string) => bcrypt.hash(pw, 12);
export const verifyPassword = (pw: string, hash: string) => bcrypt.compare(pw, hash);

// ---------- token ----------
export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer("gamevault")
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secretKey());
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(), { issuer: "gamevault" });
    if (!payload.userId || !payload.username) return null;
    return { userId: payload.userId as string, username: payload.username as string };
  } catch {
    return null;
  }
}

// ---------- cookie helpers (route handlers) ----------
export const sessionCookieOptions = {
  httpOnly: true as const,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: SESSION_DAYS * 24 * 60 * 60,
};

// ---------- session → user ----------
export type AuthUser = {
  id: string;
  email: string;
  username: string;
  displayName: string;
  accent: string;
  createdAt: string;
};

export async function getSessionUser(): Promise<AuthUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await verifySession(token);
  if (!session) return null;
  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { id: true, email: true, username: true, displayName: true, accent: true, createdAt: true },
  });
  if (!user) return null;
  return { ...user, createdAt: user.createdAt.toISOString() };
}

/** Session payload for broadcast events (gamer display name). */
export async function getSessionGamerName(userId: string): Promise<string> {
  const u = await db.user.findUnique({ where: { id: userId }, select: { displayName: true, username: true } });
  return u?.displayName || u?.username || "A gamer";
}
