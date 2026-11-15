/** Final cover patch: apply known covers + slow-retry the last 4 via action API */
import { execSync } from "child_process";
import fs from "fs";

const path = "/home/z/my-project/scripts/seed-data.json";
const data = JSON.parse(fs.readFileSync(path, "utf8"));

const KNOWN = {
  "Yakuza: Like a Dragon": "https://upload.wikimedia.org/wikipedia/en/2/2f/Yakuza_like_a_dragon_cover_art.jpg",
  "Mass Effect Legendary Edition": "https://upload.wikimedia.org/wikipedia/en/9/97/Mass_Effect_Legendary_Edition.jpeg",
  "DEATHLOOP": "https://upload.wikimedia.org/wikipedia/en/c/cb/Deathloop_cover_art.jpg",
};
for (const [name, url] of Object.entries(KNOWN)) {
  const g = data.find((x) => x.ok && x.name === name);
  if (g) { g.coverUrl = url; g.posterUrl = url; g.heroUrl = url; console.log("patched", name); }
}
fs.writeFileSync(path, JSON.stringify(data, null, 1));
console.log("Known covers applied.");
