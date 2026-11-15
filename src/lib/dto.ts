import type { Prisma } from "@prisma/client";

export const gameInclude = {
  genres: { include: { genre: true } },
  platforms: { include: { platform: true } },
  entries: true,
} satisfies Prisma.GameInclude;

export type GameRow = Prisma.GameGetPayload<{ include: typeof gameInclude }>;

export const entryInclude = {
  game: { include: { genres: { include: { genre: true } }, platforms: { include: { platform: true } } } },
  sessions: { orderBy: { playedOn: "desc" as const }, take: 1 },
} satisfies Prisma.LibraryEntryInclude;

export type EntryRow = Prisma.LibraryEntryGetPayload<{ include: typeof entryInclude }>;

// ---- DTOs sent to the client ----
export type GameDTO = {
  id: string;
  name: string;
  slug: string;
  summary: string | null;
  developer: string | null;
  publisher: string | null;
  releaseDate: string | null;
  criticScore: number | null;
  coverUrl: string | null;
  posterUrl: string | null;
  heroUrl: string | null;
  screenshots: string[];
  tags: string[];
  genres: { name: string; slug: string }[];
  platforms: { name: string; slug: string }[];
  source: string;
  steamAppId: number | null;
  entryId: string | null;
};

export type EntryDTO = {
  id: string;
  status: "PLAYING" | "COMPLETED" | "ON_HOLD" | "BACKLOG" | "WISHLIST" | "DROPPED";
  rating: number | null;
  hoursPlayed: number;
  startDate: string | null;
  finishDate: string | null;
  favorite: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  lastSession: { minutes: number; playedOn: string } | null;
  game: GameDTO;
};

export function toGameDTO(g: GameRow, currentUserId?: string): GameDTO {
  const e = (currentUserId ? g.entries.find((en) => en.userId === currentUserId) : g.entries[0]) ?? null;
  return {
    id: g.id,
    name: g.name,
    slug: g.slug,
    summary: g.summary,
    developer: g.developer,
    publisher: g.publisher,
    releaseDate: g.releaseDate ? g.releaseDate.toISOString() : null,
    criticScore: g.criticScore,
    coverUrl: g.coverUrl,
    posterUrl: g.posterUrl,
    heroUrl: g.heroUrl,
    screenshots: JSON.parse(g.screenshots || "[]"),
    tags: JSON.parse(g.tags || "[]"),
    genres: g.genres.map((gg) => ({ name: gg.genre.name, slug: gg.genre.slug })),
    platforms: g.platforms.map((gp) => ({ name: gp.platform.name, slug: gp.platform.slug })),
    source: g.source,
    steamAppId: g.steamAppId,
    entryId: e ? e.id : null,
  };
}

export function toEntryDTO(e: EntryRow): EntryDTO {
  const g = e.game;
  const last = [...e.sessions].sort((a, b) => b.playedOn.getTime() - a.playedOn.getTime())[0] ?? null;
  const game = toGameDTO({ ...g, entries: [{ id: e.id }] as GameRow["entries"] });
  return {
    id: e.id,
    status: e.status,
    rating: e.rating,
    hoursPlayed: e.hoursPlayed,
    startDate: e.startDate ? e.startDate.toISOString() : null,
    finishDate: e.finishDate ? e.finishDate.toISOString() : null,
    favorite: e.favorite,
    notes: e.notes,
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
    lastSession: last ? { minutes: last.minutes, playedOn: last.playedOn.toISOString() } : null,
    game,
  };
}
