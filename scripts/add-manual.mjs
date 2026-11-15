/** Add region-blocked Steam games as manual entries (Wikipedia covers + curated metadata) */
import { execSync } from "child_process";
import fs from "fs";

const UA = "Mozilla/5.0 (compatible; GameVaultSeeder/1.0)";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const MANUAL = [
  { name: "Hollow Knight", wiki: ["Hollow_Knight"], developer: "Team Cherry", publisher: "Team Cherry", releaseDate: "2017-02-24", criticScore: 87,
    genres: ["Action", "Adventure", "Metroidvania"], platforms: ["PC", "Nintendo Switch", "PlayStation 4", "Xbox One"],
    summary: "A hand-drawn metroidvania: explore the insect kingdom of Hallownest, master Nail combat and uncover the haunting story beneath the town of Dirtmouth." },
  { name: "Marvel’s Spider-Man 2", wiki: ["Spider-Man_2_(2023_video_game)"], developer: "Insomniac Games", publisher: "Sony Interactive Entertainment", releaseDate: "2023-10-20", criticScore: 90,
    genres: ["Action", "Adventure"], platforms: ["PlayStation 5", "PC"],
    summary: "Swing as both Peter Parker and Miles Morales across New York, facing Venom, Kraven and symbiote chaos in Insomniac's superhero showcase." },
  { name: "Death Stranding", wiki: ["Death_Stranding"], developer: "Kojima Productions", publisher: "505 Games", releaseDate: "2020-07-14", criticScore: 86,
    genres: ["Adventure", "Simulation"], platforms: ["PC", "PlayStation 4"],
    summary: "Sam Bridges delivers cargo across a fractured America stalked by BTs — a meditative, genre-defying journey about connection from Hideo Kojima." },
  { name: "Death Stranding Director's Cut", wiki: ["Death_Stranding_Director's_Cut"], developer: "Kojima Productions", publisher: "505 Games", releaseDate: "2022-03-30", criticScore: null,
    genres: ["Adventure", "Simulation"], platforms: ["PC", "PlayStation 5"],
    summary: "The definitive cut of Kojima's epic: new missions, gear, racing and combat expansions layered onto the original trek across the ruined UCA." },
  { name: "Alan Wake 2", wiki: ["Alan_Wake_2"], developer: "Remedy Entertainment", publisher: "Epic Games", releaseDate: "2023-10-27", criticScore: 89,
    genres: ["Horror", "Adventure", "Shooter"], platforms: ["PC", "PlayStation 5", "Xbox Series X|S"],
    summary: "A survival horror dual-protagonist nightmare: FBI agent Saga Anderson investigates a dark town while writer Alan Wake fights to rewrite reality." },
  { name: "STAR WARS Jedi: Survivor", wiki: ["Star_Wars_Jedi:_Survivor"], developer: "Respawn Entertainment", publisher: "Electronic Arts", releaseDate: "2023-04-28", criticScore: null,
    genres: ["Action", "Adventure"], platforms: ["PC", "PlayStation 5", "Xbox Series X|S"],
    summary: "Cal Kestis fights the Empire five years after Fallen Order, with new crossguard and blaster stances, larger worlds and a darker story." },
  { name: "Assassin's Creed Odyssey", wiki: ["Assassin's_Creed_Odyssey"], developer: "Ubisoft Quebec", publisher: "Ubisoft", releaseDate: "2018-10-05", criticScore: 85,
    genres: ["RPG", "Action", "Open World"], platforms: ["PC"],
    summary: "Choose Alexios or Kassandra and carve your legend across Ancient Greece — naval battles, mercenary contracts and the fate of Sparta and Athens." },
  { name: "Yakuza: Like a Dragon", wiki: ["Yakuza:_Like_a_Dragon"], developer: "Ryu Ga Gotoku Studio", publisher: "Sega", releaseDate: "2020-11-13", criticScore: null,
    genres: ["RPG", "Adventure"], platforms: ["PC", "PlayStation 4", "Xbox One"],
    summary: "Ichiban Kasuga steps out of 18 years of prison into turn-based JRPG combat, rooftops, karaoke and crime drama in Ijincho and Kamurocho." },
  { name: "Mass Effect Legendary Edition", wiki: ["Mass_Effect_Legendary_Edition"], developer: "BioWare", publisher: "Electronic Arts", releaseDate: "2021-05-14", criticScore: null,
    genres: ["RPG", "Shooter"], platforms: ["PC"],
    summary: "The remastered trilogy: all three Mass Effect campaigns, 40+ DLC packs and your imported Commander Shepard choices across the whole saga." },
  { name: "Path of Exile", wiki: ["Path_of_Exile"], developer: "Grinding Gear Games", publisher: "Grinding Gear Games", releaseDate: "2013-10-23", criticScore: null,
    genres: ["RPG", "MOBA"], platforms: ["PC"],
    summary: "The legendary free-to-play ARPG: a colossal passive skill tree, deep item crafting, seasonal leagues and Wraeclast's dark fantasy world." },
  { name: "Lost Ark", wiki: ["Lost_Ark_(video_game)"], developer: "Smilegate RPG", publisher: "Amazon Games", releaseDate: "2022-02-11", criticScore: null,
    genres: ["MMORPG", "RPG"], platforms: ["PC"],
    summary: "An isometric MMORPG ARPG hybrid: roam Arkesia, raid legions with your party and chase the Ark in explosive class-based combat." },
  { name: "Against the Storm", wiki: ["Against_the_Storm"], developer: "Eremite Games", publisher: "Hooded Horse", releaseDate: "2023-12-13", criticScore: 89,
    genres: ["Strategy", "Simulation"], platforms: ["PC"],
    summary: "A roguelite city-builder against apocalyptic rain: found settlements for the Scorched Queen before the Blightstorm wipes the map clean." },
  { name: "DEATHLOOP", wiki: ["Deathloop"], developer: "Arkane Studios", publisher: "Bethesda Softworks", releaseDate: "2022-09-20", criticScore: 88,
    genres: ["Shooter", "Adventure"], platforms: ["PC", "PlayStation 5"],
    summary: "Blackwater Island loops forever: assassinate eight Visionaries before midnight, keep the clues and break the time cycle — or be hunted yourself." },
  { name: "Pillars of Eternity II: Deadfire", wiki: ["Pillars_of_Eternity_II:_Deadfire"], developer: "Obsidian Entertainment", publisher: "Versus Evil", releaseDate: "2018-05-08", criticScore: 88,
    genres: ["RPG", "Adventure"], platforms: ["PC"],
    summary: "Captain a ship across the Deadfire Archipelago chasing the god Eothas — classic isometric CRPG with deep parties and naval encounters." },
  { name: "Manor Lords", wiki: ["Manor_Lords"], developer: "Slavic Magic", publisher: "Hooded Horse", releaseDate: "2024-04-26", criticScore: null,
    genres: ["Strategy", "Simulation"], platforms: ["PC"],
    summary: "A medieval city-builder with organic gridless growth, realistic agriculture, seasonal economies and big-picture tactical battles." },
];

function wikiCover(titles) {
  for (const t of titles) {
    try {
      const out = execSync(`curl -s --max-time 20 -A "${UA}" "https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(t)}"`, { encoding: "utf8" });
      const j = JSON.parse(out);
      const orig = j?.originalimage?.source;
      if (!orig) continue;
      const thumb = orig.replace(/\/(\d+)px-/, "/500px-");
      let cover = orig.split("?")[0];
      try {
        const code = execSync(`curl -s -o /dev/null -w "%{http_code}" --max-time 15 -A "${UA}" -I "${thumb}"`, { encoding: "utf8" });
        if (code.trim().startsWith("2")) cover = thumb.split("?")[0];
      } catch { /* use orig */ }
      return cover;
    } catch { /* next */ }
  }
  return null;
}

const path = "/home/z/my-project/scripts/seed-data.json";
const data = JSON.parse(fs.readFileSync(path, "utf8"));
const have = new Set(data.filter((g) => g.ok).map((g) => g.name));
let added = 0;
for (const m of MANUAL) {
  if (have.has(m.name)) { console.log(`have ${m.name}`); continue; }
  const poster = wikiCover(m.wiki);
  data.push({
    ok: true, source: "manual", steamAppId: null,
    name: m.name, summary: m.summary,
    developer: m.developer, publisher: m.publisher,
    releaseDate: m.releaseDate, criticScore: m.criticScore,
    coverUrl: poster, posterUrl: poster, heroUrl: poster,
    screenshots: [], tags: [],
    genres: m.genres, platforms: m.platforms,
  });
  console.log(`${poster ? "OK  " : "MISS"} ${m.name}`);
  added++;
  await sleep(200);
}
fs.writeFileSync(path, JSON.stringify(data, null, 1));
console.log(`\nAdded ${added}. Snapshot: ${data.filter((g) => g.ok).length} games`);
