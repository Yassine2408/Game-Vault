/** Seed the public game catalog from the bundled snapshot. */
import { PrismaClient } from "@prisma/client";
import fs from "fs";

// resolve DATABASE_URL: prefer a real postgres:// process env, else parse .env
function resolveDatabaseUrl() {
  const envUrl = process.env.DATABASE_URL;
  if (envUrl && /^postgres(ql)?:\/\//.test(envUrl)) return envUrl;
  try {
    for (const line of fs.readFileSync(new URL("../.env", import.meta.url), "utf8").split("\n")) {
      const m = line.match(/^\s*DATABASE_URL\s*=\s*(.+)\s*$/);
      if (m) {
        const val = m[1].trim().replace(/^["']|["']$/g, "");
        if (val && !val.startsWith("#")) return val;
      }
    }
  } catch {}
  return envUrl;
}

const db = new PrismaClient({ datasourceUrl: resolveDatabaseUrl() });
const dump = JSON.parse(fs.readFileSync(new URL("./sqlite-dump.json", import.meta.url), "utf8"));

const d = (s) => (s ? new Date(s) : null);

async function main() {
  // 1) genres & platforms
  for (const g of dump.Genre) {
    await db.genre.upsert({ where: { id: g.id }, update: {}, create: { id: g.id, name: g.name, slug: g.slug } });
  }
  for (const p of dump.Platform) {
    await db.platform.upsert({ where: { id: p.id }, update: {}, create: { id: p.id, name: p.name, slug: p.slug } });
  }
  console.log(`genres: ${dump.Genre.length}, platforms: ${dump.Platform.length}`);

  // 2) games
  for (const g of dump.Game) {
    await db.game.upsert({
      where: { id: g.id },
      update: {},
      create: {
        id: g.id,
        name: g.name,
        slug: g.slug,
        summary: g.summary,
        developer: g.developer,
        publisher: g.publisher,
        releaseDate: d(g.releaseDate),
        criticScore: g.criticScore ?? null,
        coverUrl: g.coverUrl,
        posterUrl: g.posterUrl,
        heroUrl: g.heroUrl,
        screenshots: g.screenshots,
        tags: g.tags,
        source: g.source,
        steamAppId: g.steamAppId ?? null,
        createdAt: d(g.createdAt) ?? new Date(),
      },
    });
  }
  console.log(`games: ${dump.Game.length}`);

  // 3) relations
  for (const r of dump.GameGenre) {
    await db.gameGenre.upsert({ where: { gameId_genreId: { gameId: r.gameId, genreId: r.genreId } }, update: {}, create: { gameId: r.gameId, genreId: r.genreId } });
  }
  for (const r of dump.GamePlatform) {
    await db.gamePlatform.upsert({ where: { gameId_platformId: { gameId: r.gameId, platformId: r.platformId } }, update: {}, create: { gameId: r.gameId, platformId: r.platformId } });
  }
  console.log(`relations: ${dump.GameGenre.length + dump.GamePlatform.length}`);

  console.log("Catalog seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
