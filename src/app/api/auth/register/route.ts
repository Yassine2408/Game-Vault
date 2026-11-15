import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashPassword, signSession, SESSION_COOKIE, sessionCookieOptions, type AuthUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const registerInput = z.object({
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(20, "Username must be at most 20 characters")
    .regex(/^[a-zA-Z0-9_]+$/, "Only letters, numbers and underscores"),
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters").max(72),
  displayName: z.string().min(1).max(30).optional(),
});

const ACCENTS = ["violet", "emerald", "amber", "rose", "cyan"];

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = registerInput.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json({ error: first?.message ?? "Invalid input" }, { status: 400 });
  }
  const { username, email, password, displayName } = parsed.data;
  const uname = username.toLowerCase();

  const clash = await db.user.findFirst({
    where: { OR: [{ username: uname }, { email: email.toLowerCase() }] },
    select: { username: true, email: true },
  });
  if (clash) {
    const taken = clash.username === uname ? "Username" : "Email";
    return NextResponse.json({ error: `${taken} is already registered — try signing in instead` }, { status: 409 });
  }

  const passwordHash = await hashPassword(password);
  const accent = ACCENTS[Math.floor(Math.random() * ACCENTS.length)];
  const user = await db.user.create({
    data: {
      username: uname,
      email: email.toLowerCase(),
      passwordHash,
      displayName: displayName?.trim() || username,
      accent,
    },
  });

  const token = await signSession({ userId: user.id, username: user.username });
  const res = NextResponse.json(
    { user: { id: user.id, email: user.email, username: user.username, displayName: user.displayName, accent: user.accent, createdAt: user.createdAt.toISOString() } satisfies AuthUser },
    { status: 201 }
  );
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions);
  return res;
}
