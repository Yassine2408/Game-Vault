/** Patch Wikipedia covers into seed-data.json using curl (Bun fetch gets 403) */
import { execSync } from "child_process";
import fs from "fs";

const UA = "Mozilla/5.0 (compatible; GameVaultSeeder/1.0)";

const MANUAL_WIKI = {
  "The Legend of Zelda: Breath of the Wild": ["The_Legend_of_Zelda:_Breath_of_the_Wild"],
  "The Legend of Zelda: Tears of the Kingdom": ["The_Legend_of_Zelda:_Tears_of_the_Kingdom"],
  "Super Mario Odyssey": ["Super_Mario_Odyssey"],
  "Mario Kart 8 Deluxe": ["Mario_Kart_8_Deluxe"],
  "Super Smash Bros. Ultimate": ["Super_Smash_Bros._Ultimate"],
  "Metroid Dread": ["Metroid_Dread"],
  "Splatoon 3": ["Splatoon_3"],
  "Pokémon Legends: Arceus": ["Pok%C3%A9mon_Legends:_Arceus"],
  "Bloodborne": ["Bloodborne"],
  "Minecraft": ["Minecraft"],
  "Genshin Impact": ["Genshin_Impact"],
  "Fortnite": ["Fortnite"],
  "League of Legends": ["League_of_Legends"],
  "Valorant": ["Valorant"],
  "World of Warcraft": ["World_of_Warcraft"],
  "Astro Bot": ["Astro_Bot_(video_game)", "Astro_Bot"],
  "Halo Infinite": ["Halo_Infinite"],
};

function curlJson(url) {
  try {
    const out = execSync(`curl -s --max-time 20 -A "${UA}" "${url}"`, { encoding: "utf8" });
    return JSON.parse(out);
  } catch { return null; }
}
function curlOk(url) {
  try {
    const code = execSync(`curl -s -o /dev/null -w "%{http_code}" --max-time 20 -A "${UA}" -I "${url}"`, { encoding: "utf8" });
    return code.trim().startsWith("2");
  } catch { return false; }
}

const data = JSON.parse(fs.readFileSync("/home/z/my-project/scripts/seed-data.json", "utf8"));
const manual = data.filter((g) => g.ok && g.source === "manual");
let fixed = 0;
for (const g of manual) {
  const titles = MANUAL_WIKI[g.name] || [];
  for (const t of titles) {
    const j = curlJson(`https://en.wikipedia.org/api/rest_v1/page/summary/${t}`);
    const orig = j?.originalimage?.source;
    if (!orig) continue;
    const thumb = orig.replace(/\/(\d+)px-/, "/500px-");
    const cover = curlOk(thumb) ? thumb : orig;
    g.posterUrl = cover; g.coverUrl = cover; g.heroUrl = cover;
    console.log(`OK  ${g.name} -> ${cover.slice(0, 90)}`);
    fixed++;
    break;
  }
  if (!g.posterUrl) console.log(`MISS ${g.name}`);
  await new Promise((r) => setTimeout(r, 250));
}
fs.writeFileSync("/home/z/my-project/scripts/seed-data.json", JSON.stringify(data, null, 1));
console.log(`\nFixed ${fixed}/${manual.length} covers`);
