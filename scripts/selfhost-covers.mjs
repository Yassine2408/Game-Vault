/** Download Wikipedia-hosted covers into /public/covers and rewrite DB URLs */
import { execSync } from "child_process";
import fs from "fs";
import { PrismaClient } from "@prisma/client";

const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";
const db = new PrismaClient();
const DIR = "/home/z/my-project/public/covers";

function uploadToThumb(u, width = 500) {
  // https://upload.wikimedia.org/wikipedia/en/c/c6/File.jpg
  // -> https://thumb.wikimedia.org/wikipedia/en/thumb/c/c6/File.jpg/500px-File.jpg
  const m = u.match(/upload\.wikimedia\.org\/wikipedia\/(en|commons)\/([0-9a-f]{1}\/[0-9a-f]{2})\/([^/?#]+)$/);
  if (!m) return null;
  const [, , path, file] = m;
  return `https://thumb.wikimedia.org/wikipedia/${m[1]}/thumb/${path}/${file}/${width}px-${file}`;
}

async function main() {
  fs.mkdirSync(DIR, { recursive: true });
  const games = await db.game.findMany({ where: { source: "manual" } });
  let ok = 0, fail = 0;
  for (const g of games) {
    if (!g.posterUrl || !g.posterUrl.includes("wikimedia")) continue;
    const slug = g.slug;
    const ext = g.posterUrl.match(/\.(png|jpe?g)$/i)?.[1]?.toLowerCase() ?? "jpg";
    const local = `/covers/${slug}.${ext === "jpeg" ? "jpg" : ext}`;
    const path = `${DIR}/${slug}.${ext === "jpeg" ? "jpg" : ext}`;
    if (fs.existsSync(path) && fs.statSync(path).size > 4000) {
      // already downloaded
    } else {
      const candidates = [uploadToThumb(g.posterUrl, 500), g.posterUrl.replace("upload.wikimedia.org", "thumb.wikimedia.org").replace(/wikipedia\/(en|commons)\//, "wikipedia/$1/thumb/$&/").split("?")[0]];
      let done = false;
      for (const url of candidates.filter(Boolean)) {
        for (let attempt = 0; attempt < 4 && !done; attempt++) {
          try {
            const code = execSync(
              `curl -sL -o "${path}" -w "%{http_code}" --max-time 25 -A "${UA}" "${url}"`,
              { encoding: "utf8" }
            ).trim();
            const size = fs.existsSync(path) ? fs.statSync(path).size : 0;
            const isImg = code === "200" && size > 4000;
            console.log(`${isImg ? "OK  " : "MISS"} ${g.name} (${code}, ${size}b) ${url.slice(0, 90)}`);
            if (isImg) { done = true; break; }
          } catch (e) { console.log(`ERR ${g.name}: ${e.message}`); }
          await new Promise((r) => setTimeout(r, (attempt + 1) * 8000)); // backoff for 429
        }
        if (done) break;
      }
      if (!done) { fail++; continue; }
    }
    await db.game.update({ where: { id: g.id }, data: { posterUrl: local, coverUrl: local, heroUrl: local } });
    ok++;
    console.log(`DB  ${g.name} -> ${local}`);
  }
  console.log(`\nDone: ${ok} self-hosted, ${fail} failed`);
  await db.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
