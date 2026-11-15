import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { entryInclude, toEntryDTO } from "@/lib/dto";
import { computeTotals } from "@/lib/stats-server";

export const dynamic = "force-dynamic";

const MONTHS_COUNT = 12;

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const entries = await db.libraryEntry.findMany({
    where: { userId: user.id },
    include: {
      game: { include: { genres: { include: { genre: true } }, platforms: { include: { platform: true } } } },
      sessions: true,
    },
  });
  const now = new Date();
  const months: string[] = [];
  for (let i = MONTHS_COUNT - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(monthKey(d));
  }
  const monthLabel = (key: string) => {
    const [y, m] = key.split("-").map(Number);
    return new Date(y, m - 1, 1).toLocaleString("en-US", { month: "short" });
  };

  const totals = await computeTotals(user.id);
  const statusCounts: Record<string, number> = {
    PLAYING: totals.playing,
    COMPLETED: totals.finished,
    ON_HOLD: totals.onHold,
    BACKLOG: totals.backlog,
    WISHLIST: totals.wishlist,
    DROPPED: totals.dropped,
  };

  const finishesPerMonth = months.map((m) => ({
    month: monthLabel(m),
    count: entries.filter((e) => e.status === "COMPLETED" && e.finishDate && monthKey(e.finishDate) === m).length,
  }));

  const hoursPerMonth = months.map((m) => ({
    month: monthLabel(m),
    hours: Math.round(entries.flatMap((e) => e.sessions).filter((s) => monthKey(s.playedOn) === m).reduce((a, s) => a + s.minutes, 0) / 60),
  }));

  // genre counts among tracked (non-wishlist) games
  const genreCounts = new Map<string, number>();
  entries
    .filter((e) => e.status !== "WISHLIST")
    .forEach((e) => e.game.genres.forEach((gg) => genreCounts.set(gg.genre.name, (genreCounts.get(gg.genre.name) || 0) + 1)));
  const topGenres = [...genreCounts.entries()].map(([genre, count]) => ({ genre, count })).sort((a, b) => b.count - a.count).slice(0, 8);

  const rated = entries.filter((e) => e.rating != null);
  const ratingDist = Array.from({ length: 10 }, (_, i) => ({
    rating: i + 1,
    count: rated.filter((e) => e.rating === i + 1).length,
  }));

  const topRated = rated.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0)).slice(0, 8).map(toEntryDTO);

  // recent activity feed: sessions + completions
  const sessionItems = await db.playSession.findMany({
    where: { userId: user.id },
    orderBy: { playedOn: "desc" },
    take: 8,
    include: { game: { select: { name: true, posterUrl: true, coverUrl: true } } },
  });
  const recentFinishes = entries
    .filter((e) => e.status === "COMPLETED" && e.finishDate)
    .sort((a, b) => (b.finishDate!.getTime() ?? 0) - (a.finishDate!.getTime() ?? 0))
    .slice(0, 6)
    .map((e) => ({
      type: "finish" as const,
      date: e.finishDate!.toISOString(),
      game: { name: e.game.name, posterUrl: e.game.posterUrl, coverUrl: e.game.coverUrl },
      rating: e.rating,
      hours: e.hoursPlayed,
    }));
  const activity = [
    ...sessionItems.map((s) => ({
      type: "session" as const,
      date: s.playedOn.toISOString(),
      game: { name: s.game.name, posterUrl: s.game.posterUrl, coverUrl: s.game.coverUrl },
      minutes: s.minutes,
    })),
    ...recentFinishes,
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 14);

  return NextResponse.json({
    totals,
    finishesPerMonth,
    hoursPerMonth,
    topGenres,
    ratingDist,
    topRated,
    activity,
  });
}
