import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { computeTotals } from "@/lib/stats-server";

export const dynamic = "force-dynamic";

/**
 * Compact snapshot consumed by the realtime service (server-to-server):
 * community totals for live stat pushes + tracked games for the community
 * pulse and Steam concurrent-player polling.
 */
export async function GET() {
  const [totals, entries] = await Promise.all([
    computeTotals(), // community-wide
    db.libraryEntry.findMany({
      orderBy: { updatedAt: "desc" },
      select: {
        status: true,
        game: {
          select: { id: true, name: true, steamAppId: true, posterUrl: true, coverUrl: true },
        },
        sessions: { orderBy: { playedOn: "desc" as const }, take: 1, select: { playedOn: true } },
      },
    }),
  ]);

  const games = entries.map((e) => ({
    id: e.game.id,
    name: e.game.name,
    steamAppId: e.game.steamAppId,
    posterUrl: e.game.posterUrl,
    coverUrl: e.game.coverUrl,
    status: e.status,
    lastSessionAt: e.sessions[0]?.playedOn?.toISOString() ?? null,
  }));

  return NextResponse.json({ totals, games, ts: new Date().toISOString() });
}
