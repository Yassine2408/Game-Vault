/** Fetch corrected/extra Steam appids, append to snapshot, drop junk entries */
import fs from "fs";

const UA = "Mozilla/5.0 (compatible; GameVaultSeeder/1.0)";
const EXTRAS = [
  1716740, // Starfield
  753640,  // Outer Wilds
  945360,  // Among Us
  1113000, // Persona 4 Golden
  1272080, // PAYDAY 3
  2072450, // Like a Dragon: Infinite Wealth
  3489700, // Stellar Blade
  601150,  // Devil May Cry 5
  1363080, // Manor Lords
  2669320, // EA SPORTS FC 25
  2622380, // ELDEN RING NIGHTREIGN
];
// junk / wrong-game entries to drop
const DROP = new Set([1938090, 3485390, 1689000, 2075020, 1272140, 753650]);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchGame(appid) {
  for (const delay of [400, 1200, 3000]) {
    try {
      const res = await fetch(
        `https://store.steampowered.com/api/appdetails?appids=${appid}&l=en&filters=basic,genres,release_date,metacritic,screenshots,categories,developers,publishers,platforms`,
        { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(20000) }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const j = await res.json();
      const p = j?.[String(appid)];
      if (!p?.success || !p?.data) throw new Error("not successful");
      return p.data;
    } catch (e) {
      console.log(`  appid ${appid} failed: ${e.message}, retry`);
      await sleep(delay);
    }
  }
  return null;
}
async function exists(url) {
  try {
    const res = await fetch(url, { method: "HEAD", headers: { "User-Agent": UA }, signal: AbortSignal.timeout(12000) });
    return res.ok;
  } catch { return false; }
}

const path = "/home/z/my-project/scripts/seed-data.json";
const data = JSON.parse(fs.readFileSync(path, "utf8")).filter(
  (g) => !g.steamAppId || !DROP.has(g.steamAppId)
);
const have = new Set(data.filter((g) => g.ok && g.steamAppId).map((g) => g.steamAppId));

for (const appid of EXTRAS) {
  if (have.has(appid)) { console.log(`already have ${appid}`); continue; }
  const g = await fetchGame(appid);
  if (!g || g.type !== "game") { console.log(`appid ${appid} SKIP`); continue; }
  const header = g.header_image || null;
  const posterLib = `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/library_600x900.jpg`;
  const poster = (await exists(posterLib)) ? posterLib : header;
  const shots = (g.screenshots || []).map((s) => s.path_full).slice(0, 6);
  const cats = (g.categories || []).map((c) => c.description);
  const dateStr = g.release_date?.date || "";
  const parsed = dateStr ? new Date(dateStr.replace(/,/, "")) : null;
  const releaseDate = parsed && !isNaN(parsed) && parsed.getFullYear() > 1990 ? parsed.toISOString().slice(0, 10) : null;
  data.push({
    ok: true, source: "steam", steamAppId: appid,
    name: g.name, summary: g.short_description || "",
    developer: (g.developers || [])[0] || null, publisher: (g.publishers || [])[0] || null,
    releaseDate, criticScore: g.metacritic?.score ?? null,
    coverUrl: header, posterUrl: poster, heroUrl: shots[0] || header,
    screenshots: shots,
    tags: cats.filter((c) => /single|multi|co-op|pvp|pve|controller|remote play|vr support|hdr|cross/i.test(c)).slice(0, 6),
    genres: (g.genres || []).map((x) => x.description),
    platforms: g.platforms?.windows ? ["PC"] : [],
  });
  console.log(`+ ${g.name} (meta ${g.metacritic?.score ?? "-"})`);
  await sleep(400);
}

fs.writeFileSync(path, JSON.stringify(data, null, 1));
const good = data.filter((g) => g.ok);
console.log(`\nSnapshot now: ${good.length} games`);
