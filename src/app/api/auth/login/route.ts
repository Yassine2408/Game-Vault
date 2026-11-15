import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { verifyPassword, signSession, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

const loginInput = z.object({
  identifier: z.string().min(1, "Enter your email or username").max(120),
  password: z.string().min(1, "Enter your password").max(72),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = loginInput.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const { identifier, password } = parsed.data;
  const id = identifier.trim().toLowerCase();

  const user = await db.user.findFirst({
    where: { OR: [{ email: id }, { username: id }] },
  });
  // constant-shape response to avoid user enumeration
  const badCreds = NextResponse.json({ error: "Wrong email/username or password" }, { status: 401 });
  if (!user) return badCreds;
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) return badCreds;

  const token = await signSession({ userId: user.id, username: user.username });
  const res = NextResponse.json({
    user: { id: user.id, email: user.email, username: user.username, displayName: user.displayName, accent: user.accent, createdAt: user.createdAt.toISOString() },
  });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions);
  return res;
}
