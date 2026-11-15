import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  const [genres, platforms, totalGames, statusCounts] = await Promise.all([
    db.gameGenre.groupBy({ by: ["genreId"], _count: { gameId: true } }),
    db.gamePlatform.groupBy({ by: ["platformId"], _count: { gameId: true } }),
    db.game.count(),
    db.libraryEntry.groupBy({ by: ["status"], _count: { id: true }, where: user ? { userId: user.id } : undefined }),
  ]);

  const [genreRows, platformRows] = await Promise.all([
    db.genre.findMany({ where: { id: { in: genres.map((g) => g.genreId) } } }),
    db.platform.findMany({ where: { id: { in: platforms.map((p) => p.platformId) } } }),
  ]);

  const genreMap = new Map(genreRows.map((g) => [g.id, g]));
  const platformMap = new Map(platformRows.map((p) => [p.id, p]));

  return NextResponse.json({
    totalGames,
    genres: genres
      .map((g) => ({ name: genreMap.get(g.genreId)?.name ?? "?", slug: genreMap.get(g.genreId)?.slug ?? "?", count: g._count.gameId }))
      .sort((a, b) => b.count - a.count),
    platforms: platforms
      .map((p) => ({ name: platformMap.get(p.platformId)?.name ?? "?", slug: platformMap.get(p.platformId)?.slug ?? "?", count: p._count.gameId }))
      .sort((a, b) => b.count - a.count),
    statusCounts: statusCounts.map((s) => ({ status: s.status, count: s._count.id })),
  });
}
