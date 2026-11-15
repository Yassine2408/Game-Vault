/** Retry failed appids using curl subprocess (bypasses Bun fetch age-gate quirk) */
import { execSync } from "child_process";
import fs from "fs";

const UA = "Mozilla/5.0 (compatible; GameVaultSeeder/1.0)";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const CANDIDATES = [580130, 2456540, 1190490, 1859570, 2371500, 1774570, 812520, 1575080, 1178620, 238960, 1599340, 103030, 1466540, 1252360, 1792080];

function curlJson(appid) {
  try {
    const url = `https://store.steampowered.com/api/appdetails?appids=${appid}&l=en&filters=basic,genres,release_date,metacritic,screenshots,categories,developers,publishers,platforms`;
    const out = execSync(`curl -s --compressed --max-time 25 -A "${UA}" "${url}"`, { encoding: "utf8", maxBuffer: 20 * 1024 * 1024 });
    const j = JSON.parse(out);
    const p = j?.[String(appid)];
    return p?.success ? p.data : null;
  } catch (e) { return null; }
}
function curlOk(url) {
  try {
    const code = execSync(`curl -s -o /dev/null -w "%{http_code}" --max-time 15 -A "${UA}" -I "${url}"`, { encoding: "utf8" });
    return code.trim().startsWith("2");
  } catch { return false; }
}

const path = "/home/z/my-project/scripts/seed-data.json";
const data = JSON.parse(fs.readFileSync(path, "utf8"));

for (const appid of CANDIDATES) {
  const g = curlJson(appid);
  if (!g || g.type !== "game") { console.log(`${appid} FAIL`); continue; }
  const header = g.header_image || null;
  const posterLib = `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/library_600x900.jpg`;
  const poster = curlOk(posterLib) ? posterLib : header;
  const shots = (g.screenshots || []).map((s) => s.path_full).slice(0, 6);
  const cats = (g.categories || []).map((c) => c.description);
  const dateStr = g.release_date?.date || "";
  const parsed = dateStr ? new Date(dateStr.replace(/,/, "")) : null;
  const releaseDate = parsed && !isNaN(parsed) && parsed.getFullYear() > 1990 ? parsed.toISOString().slice(0, 10) : null;
  const existing = data.findIndex((x) => x.steamAppId === appid);
  const entry = {
    ok: true, source: "steam", steamAppId: appid,
    name: g.name, summary: g.short_description || "",
    developer: (g.developers || [])[0] || null, publisher: (g.publishers || [])[0] || null,
    releaseDate, criticScore: g.metacritic?.score ?? null,
    coverUrl: header, posterUrl: poster, heroUrl: shots[0] || header,
    screenshots: shots,
    tags: cats.filter((c) => /single|multi|co-op|pvp|pve|controller|remote play|vr support|hdr|cross/i.test(c)).slice(0, 6),
    genres: (g.genres || []).map((x) => x.description),
    platforms: g.platforms?.windows ? ["PC"] : [],
  };
  if (existing >= 0) data[existing] = entry; else data.push(entry);
  console.log(`OK ${appid} -> ${g.name} (meta ${g.metacritic?.score ?? "-"})`);
  await sleep(500);
}

fs.writeFileSync(path, JSON.stringify(data, null, 1));
console.log(`Snapshot: ${data.filter((g) => g.ok).length} games`);
