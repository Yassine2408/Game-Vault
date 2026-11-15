/**
 * GameVault seed-data fetcher
 * - Steam appdetails (public, no key): name, description, genres, release date,
 *   metacritic, developer, publisher, screenshots, categories, platforms
 * - Steam CDN poster check: library_600x900.jpg (portrait capsule) w/ header.jpg fallback
 * - Wikipedia REST summary: official box art for non-Steam exclusives
 * Output: scripts/seed-data.json (snapshot used by seed.mjs — no re-fetch needed)
 */
const UA = "Mozilla/5.0 (compatible; GameVaultSeeder/1.0)";
const APPIDS = [
  // RPG / ARPG / Souls
  292030, 1091500, 1245620, 814380, 374320, 570940, 1174180, 1086940, 435150, 291650,
  632470, 1938090, 489830, 377160, 1151340, 1184370, 580130, 1627720, 1771300, 379430,
  // Action adventure / Sony & big AAA
  1593500, 2322010, 1817070, 1817190, 2456540, 1888930, 2531310, 1659420, 2215430, 1259420,
  1190490, 1859570, 870780, 2371500, 1172380, 1774570, 1332010, 1196590, 2050650, 2124490,
  3485390, 1643320, 582010, 1446780, 2246340, 812520, 2208920, 552520, 271590, 607080,
  524220, 1113560, 1687950, 1689000, 2161700, 2679460, 1462040, 2909400, 2515020, 39210,
  1575080, 638970, 2075020, 1178620,
  // Shooters / multiplayer
  553850, 2358720, 2357570, 2767030, 230410, 238960, 2344520, 1599340, 730, 570,
  1085660, 1172470, 578080, 252490, 221100, 346110, 440900, 594650, 1238840, 550,
  218620, 1272140, 397540, 548430, 1966720, 739630, 445220, 1097150, 252950, 236390,
  306130, 1063730, 275850, 1623730, 1604030, 108600, 892970, 648800, 1203620, 242760,
  1326470, 815370, 962130, 361420,
  // Xbox / Microsoft first party
  976730, 1097840, 1172620, 1551360, 1293830, 1250410,
  // Fighting / co-op
  1364780, 1778820, 1384160, 1426210, 2001120, 1222700, 728880,
  // Indie / metroidvania / roguelike
  588650, 103030, 1030300, 261570, 1057090, 504230, 268910, 391540, 1671210, 413150,
  105600, 219740, 294100, 427520, 526870, 1366540, 255710, 949230, 264710, 646570,
  590380, 212680, 250900, 632360, 1794680, 1313140, 2379780, 1868140, 553420, 753650,
  653530, 1092790,
  // Strategy
  289070, 281990, 394360, 1158310, 268500, 323190, 1466540, 1142710, 813780, 1466860,
  // Classics / misc
  620, 400, 220, 546560, 8870, 409710, 480490, 403640, 1252360, 782330,
  379720, 3017860, 227300, 244210, 620980, 1792080, 2183900, 1903340,
];

const MANUAL_GAMES = [
  {
    name: "The Legend of Zelda: Breath of the Wild",
    wiki: ["The_Legend_of_Zelda:_Breath_of_the_Wild"],
    developer: "Nintendo EPD", publisher: "Nintendo",
    releaseDate: "2017-03-03", criticScore: 97,
    genres: ["Action", "Adventure", "Open World"], platforms: ["Nintendo Switch"],
    summary: "An open-air action-adventure in which Link awakens from a hundred-year slumber to defeat Calamity Ganon and freely explore the vast kingdom of Hyrule.",
  },
  {
    name: "The Legend of Zelda: Tears of the Kingdom",
    wiki: ["The_Legend_of_Zelda:_Tears_of_the_Kingdom"],
    developer: "Nintendo EPD", publisher: "Nintendo",
    releaseDate: "2023-05-12", criticScore: 96,
    genres: ["Action", "Adventure", "Open World"], platforms: ["Nintendo Switch"],
    summary: "The sequel to Breath of the Wild. Link explores the skies and depths of Hyrule with new Ultrahand, Fuse and Recall abilities to defeat the Demon King.",
  },
  {
    name: "Super Mario Odyssey",
    wiki: ["Super_Mario_Odyssey"],
    developer: "Nintendo EPD", publisher: "Nintendo",
    releaseDate: "2017-10-27", criticScore: 97,
    genres: ["Platformer", "Adventure"], platforms: ["Nintendo Switch"],
    summary: "Mario journeys across the world in the airship Odyssey, using his new pal Cappy to possess objects and enemies while collecting Power Moons.",
  },
  {
    name: "Mario Kart 8 Deluxe",
    wiki: ["Mario_Kart_8_Deluxe"],
    developer: "Nintendo EPD", publisher: "Nintendo",
    releaseDate: "2017-04-28", criticScore: 97,
    genres: ["Racing", "Party"], platforms: ["Nintendo Switch"],
    summary: "The definitive Mario Kart: every anti-gravity track, 48 racers, Battle Mode and the Booster Course Pass — the best-selling Switch game ever.",
  },
  {
    name: "Super Smash Bros. Ultimate",
    wiki: ["Super_Smash_Bros._Ultimate"],
    developer: "Bandai Namco Studios / Sora Ltd.", publisher: "Nintendo",
    releaseDate: "2018-12-07", criticScore: 93,
    genres: ["Fighting", "Party"], platforms: ["Nintendo Switch"],
    summary: "Every fighter ever, one game. A massive crossover platform fighter featuring over 80 characters, every stage in series history and World of Light.",
  },
  {
    name: "Metroid Dread",
    wiki: ["Metroid_Dread"],
    developer: "MercurySteam / Nintendo EPD", publisher: "Nintendo",
    releaseDate: "2021-10-08", criticScore: 88,
    genres: ["Action", "Platformer", "Metroidvania"], platforms: ["Nintendo Switch"],
    summary: "Samus Aran explores planet ZDR while being hunted by invincible E.M.M.I. robots — the first all-new 2D Metroid in 19 years.",
  },
  {
    name: "Splatoon 3",
    wiki: ["Splatoon_3"],
    developer: "Nintendo EPD", publisher: "Nintendo",
    releaseDate: "2022-09-09", criticScore: 83,
    genres: ["Shooter", "Party"], platforms: ["Nintendo Switch"],
    summary: "Ink-based 4v4 Turf War battles set in the Splatlands, with new weapons, the Tableturf Battle card game and Salmon Run co-op.",
  },
  {
    name: "Pokémon Legends: Arceus",
    wiki: ["Pok%C3%A9mon_Legends:_Arceus"],
    developer: "Game Freak", publisher: "Nintendo / The Pokémon Company",
    releaseDate: "2022-01-28", criticScore: 83,
    genres: ["RPG", "Adventure"], platforms: ["Nintendo Switch"],
    summary: "An open-world Pokémon adventure set in ancient Hisui, where you survey wild Pokémon, complete the first Pokédex and meet the creator Arceus.",
  },
  {
    name: "Bloodborne",
    wiki: ["Bloodborne"],
    developer: "FromSoftware", publisher: "Sony Interactive Entertainment",
    releaseDate: "2015-03-24", criticScore: 92,
    genres: ["Action", "RPG", "Horror"], platforms: ["PlayStation 4"],
    summary: "A gothic action RPG in the plague-stricken city of Yharnam. Fast, aggressive combat and Lovecraftian horror from the makers of Dark Souls.",
  },
  {
    name: "Minecraft",
    wiki: ["Minecraft"],
    developer: "Mojang Studios", publisher: "Mojang Studios",
    releaseDate: "2011-11-18", criticScore: 93,
    genres: ["Sandbox", "Survival", "Simulation"], platforms: ["PC", "Nintendo Switch", "PlayStation 5", "Xbox Series X|S", "Mobile"],
    summary: "The best-selling game of all time: build, mine, craft and survive in an infinite procedurally-generated world, solo or with friends.",
  },
  {
    name: "Genshin Impact",
    wiki: ["Genshin_Impact"],
    developer: "HoYoverse", publisher: "HoYoverse",
    releaseDate: "2020-09-28", criticScore: null,
    genres: ["RPG", "Adventure", "Open World"], platforms: ["PC", "PlayStation 5", "Mobile"],
    summary: "A free-to-play open-world action RPG across the elemental nations of Teyvat, with party-based elemental combat and gacha character collecting.",
  },
  {
    name: "Fortnite",
    wiki: ["Fortnite"],
    developer: "Epic Games", publisher: "Epic Games",
    releaseDate: "2017-07-25", criticScore: null,
    genres: ["Shooter", "Sandbox"], platforms: ["PC", "PlayStation 5", "Xbox Series X|S", "Nintendo Switch", "Mobile"],
    summary: "The cultural phenomenon battle royale: 100 players, building mechanics, constant live-service seasons, plus LEGO, Rocket Racing and Festival modes.",
  },
  {
    name: "League of Legends",
    wiki: ["League_of_Legends"],
    developer: "Riot Games", publisher: "Riot Games",
    releaseDate: "2009-10-27", criticScore: null,
    genres: ["MOBA", "Strategy"], platforms: ["PC"],
    summary: "The world's most-played MOBA: 5v5 battles on Summoner's Rift with 160+ champions, ranked seasons and the biggest esport on the planet.",
  },
  {
    name: "Valorant",
    wiki: ["Valorant"],
    developer: "Riot Games", publisher: "Riot Games",
    releaseDate: "2020-06-02", criticScore: null,
    genres: ["Shooter", "Tactical"], platforms: ["PC"],
    summary: "A 5v5 character-based tactical shooter mixing precise gunplay with agent abilities — CS:GO aim meets hero shooter utility.",
  },
  {
    name: "World of Warcraft",
    wiki: ["World_of_Warcraft"],
    developer: "Blizzard Entertainment", publisher: "Blizzard Entertainment",
    releaseDate: "2004-11-23", criticScore: null,
    genres: ["MMORPG", "RPG"], platforms: ["PC"],
    summary: "The legendary MMORPG in Azeroth — raids, dungeons, PvP and 20 years of expansions, now with Classic and modern editions.",
  },
  {
    name: "Astro Bot",
    wiki: ["Astro_Bot_(video_game)", "Astro_Bot"],
    developer: "Team Asobi", publisher: "Sony Interactive Entertainment",
    releaseDate: "2024-09-06", criticScore: 94,
    genres: ["Platformer", "Adventure"], platforms: ["PlayStation 5"],
    summary: "ASTRO's PlayStation 5 showpiece: 80 levels celebrating 30 years of PlayStation, packed with gadgets, cameos and pure platforming joy.",
  },
  {
    name: "Halo Infinite",
    wiki: ["Halo_Infinite"],
    developer: "343 Industries", publisher: "Xbox Game Studios",
    releaseDate: "2021-12-08", criticScore: null,
    genres: ["Shooter", "Adventure"], platforms: ["Xbox Series X|S", "PC"],
    summary: "The Master Chief returns in an open-sandbox Zeta Halo campaign with the Grappleshot, plus a free-to-play multiplayer with Seasonal PvE modes.",
  },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const out = [];

async function fetchGame(appid) {
  for (const delay of [400, 1200, 3000]) {
    try {
      const res = await fetch(
        `https://store.steampowered.com/api/appdetails?appids=${appid}&l=en&filters=basic,genres,release_date,metacritic,screenshots,categories,developers,publishers,platforms`,
        { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(20000) }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const j = await res.json();
      const payload = j?.[String(appid)];
      if (!payload?.success || !payload?.data) throw new Error("not successful");
      return payload.data;
    } catch (e) {
      console.log(`  appid ${appid} attempt failed: ${e.message}, retrying`);
      await sleep(delay);
    }
  }
  return null;
}

async function exists(url) {
  try {
    const res = await fetch(url, { method: "HEAD", headers: { "User-Agent": UA }, signal: AbortSignal.timeout(12000) });
    return res.ok;
  } catch {
    return false;
  }
}

async function wikiCover(titles) {
  for (const t of titles) {
    try {
      const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(t)}`, {
        headers: { "User-Agent": UA }, signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) continue;
      const j = await res.json();
      const orig = j?.originalimage?.source;
      if (!orig) continue;
      // try a 500px thumb for lighter payload, fall back to original
      const thumb = orig.replace(/\/(\d+)px-/, "/500px-");
      return (await exists(thumb)) ? thumb : orig;
    } catch { /* next title */ }
  }
  return null;
}

console.log(`Fetching ${APPIDS.length} Steam games...`);
for (let i = 0; i < APPIDS.length; i++) {
  const appid = APPIDS[i];
  const g = await fetchGame(appid);
  if (!g || g.type !== "game") {
    console.log(`[${i + 1}/${APPIDS.length}] appid ${appid} -> SKIPPED (not a game)`);
    out.push({ appid, ok: false });
    continue;
  }
  const header = g.header_image || null;
  const posterLib = `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/library_600x900.jpg`;
  const poster = (await exists(posterLib)) ? posterLib : header;
  const shots = (g.screenshots || []).map((s) => s.path_full).slice(0, 6);
  const cats = (g.categories || []).map((c) => c.description);
  const keepTags = cats.filter((c) =>
    /single|multi|co-op|pvp|pve|controller|remote play|vr support|hdr|cross/i.test(c)
  ).slice(0, 6);
  const dateStr = g.release_date?.date || "";
  const parsed = dateStr ? new Date(dateStr.replace(/,/, "")) : null;
  const releaseDate = parsed && !isNaN(parsed) && parsed.getFullYear() > 1990 ? parsed.toISOString().slice(0, 10) : null;
  out.push({
    ok: true,
    source: "steam",
    steamAppId: appid,
    name: g.name,
    summary: g.short_description || "",
    developer: (g.developers || [])[0] || null,
    publisher: (g.publishers || [])[0] || null,
    releaseDate,
    criticScore: g.metacritic?.score ?? null,
    coverUrl: header,
    posterUrl: poster,
    heroUrl: shots[0] || header,
    screenshots: shots,
    tags: keepTags,
    genres: (g.genres || []).map((x) => x.description),
    platforms: g.platforms?.windows ? ["PC"] : [],
    platformsMac: !!g.platforms?.mac,
  });
  console.log(`[${i + 1}/${APPIDS.length}] ${g.name} (meta: ${g.metacritic?.score ?? "-"}, poster: ${poster === posterLib ? "capsule" : "header"})`);
  await sleep(350);
}

console.log(`\nFetching ${MANUAL_GAMES.length} non-Steam games from Wikipedia...`);
for (const m of MANUAL_GAMES) {
  const poster = await wikiCover(m.wiki);
  if (!poster) console.log(`  !! no cover found for ${m.name}`);
  out.push({
    ok: true,
    source: "manual",
    steamAppId: null,
    name: m.name,
    summary: m.summary,
    developer: m.developer,
    publisher: m.publisher,
    releaseDate: m.releaseDate,
    criticScore: m.criticScore,
    coverUrl: poster,
    posterUrl: poster,
    heroUrl: poster,
    screenshots: [],
    tags: [],
    genres: m.genres,
    platforms: m.platforms,
  });
  console.log(`  ${m.name} -> ${poster ? "cover ok" : "NO COVER"}`);
  await sleep(300);
}

const fs = await import("fs");
fs.writeFileSync("/home/z/my-project/scripts/seed-data.json", JSON.stringify(out, null, 1));
const good = out.filter((g) => g.ok);
console.log(`\nDone. ${good.length} usable games (${good.filter((g) => g.source === "steam").length} steam / ${good.filter((g) => g.source === "manual").length} manual). Snapshot: scripts/seed-data.json`);
