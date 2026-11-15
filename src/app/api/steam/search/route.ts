import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * LIVE Steam store search (keyless public endpoint).
 * Returns fresh results straight from Steam, flagged with what's already in the vault.
 */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ items: [] });

  const url = `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(q)}&l=en&cc=US`;
  let data: { items?: { id: number; name: string; tiny_image?: string; metascore?: string; platforms?: Record<string, boolean> }[] } | null = null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (res.ok) data = await res.json();
  } catch {
    return NextResponse.json({ error: "Steam search unavailable right now" }, { status: 502 });
  }

  const items = (data?.items ?? []).slice(0, 18);
  const ids = items.map((i) => i.id);

  // "inVault" reflects the signed-in gamer's library; catalog match kept for reference
  const user = await getSessionUser();
  const mine = user
    ? new Set(
        (
          await db.libraryEntry.findMany({
            where: { userId: user.id, game: { steamAppId: { in: ids } } },
            select: { game: { select: { steamAppId: true } } },
          })
        ).map((e) => e.game.steamAppId)
      )
    : new Set<number>();

  return NextResponse.json({
    items: items.map((i) => ({
      appId: i.id,
      name: i.name,
      image: i.tiny_image ?? null,
      metascore: i.metascore && /^\d+$/.test(i.metascore) ? Number(i.metascore) : null,
      inVault: mine.has(i.id),
    })),
  });
}
