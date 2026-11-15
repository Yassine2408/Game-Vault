/** Retry all failed (ok:false) appids in the snapshot */
import fs from "fs";

const UA = "Mozilla/5.0 (compatible; GameVaultSeeder/1.0)";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchGame(appid) {
  for (const delay of [500, 1500, 3500]) {
    try {
      const res = await fetch(
        `https://store.steampowered.com/api/appdetails?appids=${appid}&l=en&filters=basic,genres,release_date,metacritic,screenshots,categories,developers,publishers,platforms`,
        { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(25000) }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const j = await res.json();
      const p = j?.[String(appid)];
      if (!p?.success || !p?.data) throw new Error("not successful");
      return p.data;
    } catch (e) {
      console.log(`  ${appid} fail: ${e.message}`);
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
const data = JSON.parse(fs.readFileSync(path, "utf8"));
const failed = data.filter((g) => !g.ok).map((g) => g.appid);
console.log("Retrying:", failed.join(", "));

for (const appid of failed) {
  const g = await fetchGame(appid);
  const idx = data.findIndex((x) => !x.ok && x.appid === appid);
  if (!g || g.type !== "game") {
    console.log(`${appid} still failing -> dropped from snapshot`);
    data.splice(idx, 1);
    continue;
  }
  const header = g.header_image || null;
  const posterLib = `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/library_600x900.jpg`;
  const poster = (await exists(posterLib)) ? posterLib : header;
  const shots = (g.screenshots || []).map((s) => s.path_full).slice(0, 6);
  const cats = (g.categories || []).map((c) => c.description);
  const dateStr = g.release_date?.date || "";
  const parsed = dateStr ? new Date(dateStr.replace(/,/, "")) : null;
  const releaseDate = parsed && !isNaN(parsed) && parsed.getFullYear() > 1990 ? parsed.toISOString().slice(0, 10) : null;
  data[idx] = {
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
  console.log(`OK ${appid} -> ${g.name}`);
  await sleep(600);
}

fs.writeFileSync(path, JSON.stringify(data, null, 1));
console.log(`Snapshot: ${data.filter((g) => g.ok).length} games`);
