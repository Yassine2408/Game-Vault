import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSessionUser, getSessionGamerName } from "@/lib/auth";
import { entryInclude, gameInclude, toEntryDTO, toGameDTO } from "@/lib/dto";
import { notifyActivity, notifyCatalogUpdate, clientTagFrom } from "@/lib/realtime-server";

export const dynamic = "force-dynamic";

const importInput = z.object({
  appId: z.number().int().positive(),
  track: z.enum(["PLAYING", "COMPLETED", "ON_HOLD", "BACKLOG", "WISHLIST", "DROPPED"]).nullable().optional(),
  finishDate: z.string().datetime().nullable().optional(),
});

type SteamDetails = {
  type: string;
  name: string;
  steam_appid: number;
  short_description?: string;
  developers?: string[];
  publishers?: string[];
  release_date?: { coming_soon: boolean; date: string };
  metacritic?: { score: number };
  header_image?: string;
  capsule_imagev5?: string;
  genres?: { id: string; description: string }[];
  categories?: { id: number; description: string }[];
  screenshots?: { id: number; path_full: string }[];
  platforms?: { windows: boolean; mac: boolean; linux: boolean };
};

const slugify = (s: string) =>
  s.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || `app-${Date.now()}`;

/** Fetch fresh game data straight from the Steam Store API and add it to the vault (live). */
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = importInput.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const { appId, track, finishDate } = parsed.data;
  const clientTag = clientTagFrom(req);

  // 1) live fetch from Steam
  let details: SteamDetails | null = null;
  try {
    const res = await fetch(`https://store.steampowered.com/api/appdetails?appids=${appId}&l=en`, {
      signal: AbortSignal.timeout(12000),
    });
    if (res.ok) {
      const json = (await res.json()) as Record<string, { success: boolean; data?: SteamDetails }>;
      if (json[String(appId)]?.success) details = json[String(appId)].data ?? null;
    }
  } catch {
    return NextResponse.json({ error: "Steam is unreachable right now" }, { status: 502 });
  }
  if (!details || details.type !== "game") {
    return NextResponse.json({ error: "Steam returned no data for this app" }, { status: 404 });
  }

  // 2) upsert the game + relations
  const release = details.release_date?.date && !details.release_date.coming_soon ? new Date(details.release_date.date) : null;
  const releaseDate = release && !isNaN(release.getTime()) ? release : null;
  const screenshots = (details.screenshots ?? []).slice(0, 6).map((s) => s.path_full);
  const base = `https://steamcdn-a.akamaihd.net/steam/apps/${appId}`;

  const data = {
    name: details.name,
    summary: details.short_description ?? null,
    developer: details.developers?.[0] ?? null,
    publisher: details.publishers?.[0] ?? null,
    releaseDate,
    criticScore: details.metacritic?.score ?? null,
    coverUrl: details.header_image ?? `${base}/header.jpg`,
    posterUrl: `${base}/library_600x900.jpg`,
    heroUrl: screenshots[0] ?? `${base}/library_hero.jpg`,
    screenshots: JSON.stringify(screenshots),
    tags: JSON.stringify((details.categories ?? []).slice(0, 8).map((c) => c.description)),
    source: "steam",
  };

  const game = await db.game.upsert({
    where: { steamAppId: appId },
    update: data,
    create: { ...data, slug: `steam-${appId}`, steamAppId: appId },
    include: gameInclude,
  });

  // genres / platforms relations
  const genreDescs = (details.genres ?? []).map((g) => g.description).filter(Boolean).slice(0, 6);
  for (const name of genreDescs) {
    const slug = slugify(name);
    const genre = await db.genre.upsert({ where: { slug }, update: {}, create: { name, slug } });
    await db.gameGenre.upsert({
      where: { gameId_genreId: { gameId: game.id, genreId: genre.id } },
      update: {},
      create: { gameId: game.id, genreId: genre.id },
    });
  }
  const platformNames = [
    ...(details.platforms?.windows ? ["Windows"] : []),
    ...(details.platforms?.mac ? ["macOS"] : []),
    ...(details.platforms?.linux ? ["Linux"] : []),
  ];
  for (const name of platformNames) {
    const slug = slugify(name);
    const platform = await db.platform.upsert({ where: { slug }, update: {}, create: { name, slug } });
    await db.gamePlatform.upsert({
      where: { gameId_platformId: { gameId: game.id, platformId: platform.id } },
      update: {},
      create: { gameId: game.id, platformId: platform.id },
    });
  }

  // 3) optionally track right away
  let entryDTO: ReturnType<typeof toEntryDTO> | null = null;
  if (track) {
    const now = new Date();
    const entry = await db.libraryEntry.upsert({
      where: { userId_gameId: { userId: user.id, gameId: game.id } },
      update: { status: track, finishDate: track === "COMPLETED" ? (finishDate ? new Date(finishDate) : now) : null },
      create: {
        userId: user.id,
        gameId: game.id,
        status: track,
        startDate: track === "PLAYING" ? now : null,
        finishDate: track === "COMPLETED" ? (finishDate ? new Date(finishDate) : now) : null,
      },
      include: entryInclude,
    });
    entryDTO = toEntryDTO(entry);
  }

  // 4) broadcast
  await notifyCatalogUpdate(clientTag);
  const gamer = await getSessionGamerName(user.id);
  await notifyActivity({
    gamer,
    kind: "track",
    game: { name: game.name, posterUrl: game.posterUrl, coverUrl: game.coverUrl },
    clientTag,
  });

  const gameDTO = entryDTO
    ? { ...toGameDTO(game, user.id), entryId: entryDTO.id }
    : toGameDTO(game, user.id);
  return NextResponse.json({ game: gameDTO, entry: entryDTO }, { status: 201 });
}
