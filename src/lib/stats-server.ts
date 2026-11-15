import { db } from "@/lib/db";

export type Totals = {
  gamesTracked: number;
  playing: number;
  finished: number;
  onHold: number;
  backlog: number;
  wishlist: number;
  dropped: number;
  totalHours: number;
  avgRating: number | null;
  favorites: number;
  completionRate: number;
};

/** Shared totals snapshot used by /api/stats and /api/internal/live-data (realtime service).
 *  Pass a userId for personal totals; omit for community-wide totals. */
export async function computeTotals(userId?: string): Promise<Totals> {
  const entries = await db.libraryEntry.findMany({
    where: userId ? { userId } : undefined,
    select: { status: true, rating: true, hoursPlayed: true, favorite: true, finishDate: true },
  });

  const c = { PLAYING: 0, COMPLETED: 0, ON_HOLD: 0, BACKLOG: 0, WISHLIST: 0, DROPPED: 0 };
  for (const e of entries) c[e.status] = (c[e.status] || 0) + 1;

  const rated = entries.filter((e) => e.rating != null);
  const totalHours = Math.round(entries.reduce((a, e) => a + e.hoursPlayed, 0));
  const finished = c.COMPLETED;
  const tracked = entries.length;
  const wishlist = c.WISHLIST;

  return {
    gamesTracked: tracked,
    playing: c.PLAYING,
    finished,
    onHold: c.ON_HOLD,
    backlog: c.BACKLOG,
    wishlist,
    dropped: c.DROPPED,
    totalHours,
    avgRating: rated.length ? +(rated.reduce((a, e) => a + (e.rating ?? 0), 0) / rated.length).toFixed(1) : null,
    favorites: entries.filter((e) => e.favorite).length,
    completionRate: tracked - wishlist > 0 ? Math.round((finished / (tracked - wishlist)) * 100) : 0,
  };
}
